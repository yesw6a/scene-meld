import type {
  GenerationSettings,
  ImageQuality,
  ImageSize,
  PromptDirective,
  PromptDirectiveResult,
} from "../types";

interface TextRange {
  start: number;
  end: number;
}

const SUPPORTED_RATIOS: Record<string, ImageSize> = {
  "16:9": "1536x864",
  "9:16": "864x1536",
  "1:1": "1024x1024",
};

const SIZE_LABELS: Record<ImageSize, string> = {
  "1536x864": "16:9",
  "864x1536": "9:16",
  "1024x1024": "1:1",
};

export function parsePromptDirectives(rawPrompt: string): PromptDirectiveResult {
  const prompt = normalizeFullWidthDigits(rawPrompt).trim();
  const ranges: TextRange[] = [];
  const directives: PromptDirective[] = [];
  const errors: string[] = [];
  const patch: PromptDirectiveResult["settingsPatch"] = {};

  const modeMatches = collectMatches(
    prompt,
    /(?:请|要求|需要|我要|生成|制作|创建|输出|做成|采用|切换到|设置为|设为|按照|按)\s*(?:连续)?(?:分镜|故事板|storyboard)(?:模式|形式|方式)?|^(?:分镜|故事板|storyboard)\s*[:：,，]/gi,
  );
  const shotCountMatches = collectMatches(
    prompt,
    /(?:(?:请|要求|需要)\s*)?(?:(?:直接|一次性)\s*)?(?:生成|输出|制作|创建|做)?\s*(\d{1,3})\s*(?:个)?(?:连续)?(?:镜头|分镜)(?:图|图片)?/gi,
  );
  const imageCountMatches = collectMatches(
    prompt,
    /(?:(?:请|要求|需要)\s*)?(?:(?:直接|一次性|批量)\s*)?(?:生成|输出|制作|创建|做)\s*(\d{1,3})\s*(?:张|幅|个)\s*(?:图|图片|版本|变体)?/gi,
  );
  const storyboard = modeMatches.length > 0 || shotCountMatches.length > 0;

  if (storyboard) {
    patch.mode = "storyboard";
    directives.push({ key: "mode", label: "分镜" });
    addRanges(ranges, modeMatches);
  }

  const countMatches = storyboard
    ? [...shotCountMatches, ...imageCountMatches]
    : imageCountMatches;
  const counts = uniqueNumbers(countMatches.map((match) => Number(match.groups[0])));
  if (counts.length > 1) {
    errors.push(`提示词中存在多个生成数量（${counts.join("、")}），请只保留一个。`);
  } else if (counts.length === 1) {
    const count = counts[0]!;
    if (count < 1 || count > 9) {
      errors.push(`生成数量必须在 1 到 9 之间，当前识别为 ${count}。`);
    } else if (storyboard) {
      patch.storyboardQuantity = count;
      directives.push({ key: "quantity", label: `${count} 镜头` });
    } else {
      patch.quantity = count;
      patch.mode = count > 1 ? "variations" : "direct";
      directives.push({ key: "mode", label: count > 1 ? "多变体" : "单图" });
      directives.push({ key: "quantity", label: `${count} 张` });
    }
    addRanges(ranges, countMatches);
  }

  const contextualRatioMatches = collectMatches(
    prompt,
    /(?:画面(?:比例)?|宽高比|比例|横屏|横版|竖屏|竖版|方图|正方形)\s*(?:为|是|设为|设置为|设置成)?\s*(\d{1,2})\s*[:：/]\s*(\d{1,2})/gi,
  );
  const knownRatioMatches = collectMatches(
    prompt,
    /(?<!\d)(16\s*[:：/]\s*9|9\s*[:：/]\s*16|1\s*[:：/]\s*1)(?!\d)/g,
  );
  const explicitRatios = uniqueStrings(
    [...contextualRatioMatches, ...knownRatioMatches].map((match) => {
      if (match.groups.length >= 2) return `${Number(match.groups[0])}:${Number(match.groups[1])}`;
      return match.groups[0]!.replace(/[：/\s]/g, ":").replace(/:+/g, ":");
    }),
  );

  const landscapeMatches = collectMatches(prompt, /(?:横屏|横版)(?!\s*(?:显示器|屏幕))/g);
  const portraitMatches = collectMatches(prompt, /(?:竖屏|竖版)/g);
  const squareMatches = collectMatches(prompt, /(?:方图|正方形(?:画面|图片|构图)?)/g);
  const orientationSizes = uniqueStrings([
    ...(landscapeMatches.length ? ["1536x864"] : []),
    ...(portraitMatches.length ? ["864x1536"] : []),
    ...(squareMatches.length ? ["1024x1024"] : []),
  ]) as ImageSize[];

  let resolvedSize: ImageSize | undefined;
  if (explicitRatios.length > 1) {
    errors.push(`提示词中存在多个画面比例（${explicitRatios.join("、")}），请只保留一个。`);
  } else if (explicitRatios.length === 1) {
    const ratio = explicitRatios[0]!;
    resolvedSize = SUPPORTED_RATIOS[ratio];
    if (!resolvedSize) {
      errors.push(`当前不支持 ${ratio}，请选择 16:9、9:16 或 1:1。`);
    }
  } else if (orientationSizes.length > 1) {
    errors.push("提示词中的横屏、竖屏或方图要求互相冲突，请只保留一种。");
  } else {
    resolvedSize = orientationSizes[0];
  }

  if (resolvedSize && orientationSizes.length === 1 && orientationSizes[0] !== resolvedSize) {
    errors.push(`画面方向与比例 ${SIZE_LABELS[resolvedSize]} 冲突，请确认后重试。`);
  } else if (resolvedSize) {
    patch.size = resolvedSize;
    directives.push({ key: "size", label: SIZE_LABELS[resolvedSize] });
  }
  addRanges(ranges, [...contextualRatioMatches, ...knownRatioMatches, ...landscapeMatches, ...portraitMatches, ...squareMatches]);

  const qualityMatches = collectMatches(
    prompt,
    /(?:质量|品质)\s*(?:设为|设置为|设置成|使用|要)?\s*(高|中|低)(?:档|等级)?|(?:按|使用|采用)?\s*(高|中|低)质量(?:生成|出图|模式|草稿)/g,
  );
  const qualities = uniqueStrings(qualityMatches.map((match) => match.groups.find(Boolean) ?? ""));
  if (qualities.length > 1) {
    errors.push("提示词中存在多个质量要求，请只保留高、中、低中的一种。");
  } else if (qualities.length === 1) {
    const qualityMap: Record<string, ImageQuality> = { 高: "high", 中: "medium", 低: "low" };
    const quality = qualityMap[qualities[0]!];
    if (quality) {
      patch.quality = quality;
      directives.push({ key: "quality", label: `${qualities[0]}质量` });
      addRanges(ranges, qualityMatches);
    }
  }

  const cleanPrompt = removeRanges(prompt, ranges);
  if (directives.length > 0 && !cleanPrompt) {
    errors.push("已识别生成规格，但还缺少具体的画面或故事内容。");
  }

  return { cleanPrompt: cleanPrompt || prompt, settingsPatch: patch, directives, errors };
}

export function applyPromptSettings(
  settings: GenerationSettings,
  patch: PromptDirectiveResult["settingsPatch"],
): GenerationSettings {
  return { ...settings, ...patch };
}

interface RegexMatch {
  start: number;
  end: number;
  groups: string[];
}

function collectMatches(value: string, expression: RegExp): RegexMatch[] {
  return Array.from(value.matchAll(expression), (match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    groups: match.slice(1).filter((group): group is string => typeof group === "string"),
  }));
}

function addRanges(target: TextRange[], matches: RegexMatch[]): void {
  for (const match of matches) target.push({ start: match.start, end: match.end });
}

function removeRanges(value: string, ranges: TextRange[]): string {
  const sorted = [...ranges].sort((left, right) => left.start - right.start);
  let cursor = 0;
  let result = "";
  for (const range of sorted) {
    if (range.end <= cursor) continue;
    result += value.slice(cursor, Math.max(cursor, range.start));
    cursor = range.end;
  }
  result += value.slice(cursor);
  return result
    .replace(/^[\s,，。;；:：、]+|[\s,，。;；:：、]+$/g, "")
    .replace(/\s*([,，;；、])\s*(?:[,，;；、]\s*)+/g, "$1")
    .replace(/^[的地得要为并且与和\s]+(?=[\u4e00-\u9fffA-Za-z])/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter(Number.isFinite))];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeFullWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (character) => String(character.charCodeAt(0) - 0xff10));
}
