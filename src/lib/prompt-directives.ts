import type {
  GenerationRequestSettings,
  GenerationSettings,
  ImageQuality,
  ImageRequestSize,
  PromptDirective,
  PromptDirectiveKey,
  PromptDirectiveResult,
} from "../types";
import { resolveGptImage2Ratio } from "./image-model-capabilities";
import { imageSizeLabel } from "./image-sizes";

interface TextRange {
  start: number;
  end: number;
}

const PRESET_RATIOS: Record<string, ImageRequestSize> = {
  "1:1": "1024x1024",
  "16:9": "1536x864",
  "9:16": "864x1536",
  "3:2": "1536x1024",
  "2:3": "1024x1536",
};

export function parsePromptDirectives(rawPrompt: string): PromptDirectiveResult {
  const prompt = normalizeFullWidthDigits(rawPrompt).trim();
  const ranges: TextRange[] = [];
  const directives: PromptDirective[] = [];
  const errors: string[] = [];
  const errorsByKey: Partial<Record<PromptDirectiveKey, string>> = {};
  const patch: PromptDirectiveResult["settingsPatch"] = {};

  const storyboardModeMatches = collectMatches(
    prompt,
    /(?:请|需要|我要|使用|采用|切换为|设置为|按)?\s*(?:分镜|故事板|storyboard)(?:模式|形式|方式|生成)?/gi,
  );
  const batchModeMatches = collectMatches(
    prompt,
    /(?:请|需要|我要|使用|采用|切换为|设置为|按)?\s*(?:批量(?:生成|出图|模式)|多图(?:模式|生成)?|多(?:个)?变体)/gi,
  );
  const singleModeMatches = collectMatches(
    prompt,
    /(?:请|需要|我要|使用|采用|切换为|设置为|按)?\s*(?:单图(?:模式|生成)?|单张生成)/gi,
  );
  const shotCountMatches = collectMatches(
    prompt,
    /(?:请|需要|我要)?\s*(?:生成|输出|制作|创建|做成)\s*(\d{1,3})\s*(?:个)?(?:镜头|分镜)(?:图|图片)?/gi,
  );
  const imageCountMatches = collectMatches(
    prompt,
    /(?:请|需要|我要)?\s*(?:生成|输出|制作|创建|做)\s*(\d{1,3})\s*(?:(?:张|幅)(?:图片|图像)?|个(?:图片|图像|版本|变体))/gi,
  );

  const explicitModes = [
    storyboardModeMatches.length ? "storyboard" : "",
    batchModeMatches.length ? "batch" : "",
    singleModeMatches.length ? "single" : "",
  ].filter(Boolean);
  if (explicitModes.length > 1) {
    addError(
      "mode",
      "提示词同时指定了多种生成模式。请只保留单图、多图或分镜中的一种。",
      errors,
      errorsByKey,
    );
  } else if (explicitModes[0] === "storyboard" || shotCountMatches.length) {
    patch.mode = "storyboard";
    directives.push({ key: "mode", label: "分镜" });
  } else if (explicitModes[0] === "batch") {
    patch.mode = "batch";
    directives.push({ key: "mode", label: "多图" });
  } else if (explicitModes[0] === "single") {
    patch.mode = "single";
    directives.push({ key: "mode", label: "单图" });
  }
  addRanges(ranges, [
    ...storyboardModeMatches,
    ...batchModeMatches,
    ...singleModeMatches,
  ]);

  const storyboard = patch.mode === "storyboard" || shotCountMatches.length > 0;
  const countMatches = storyboard ? shotCountMatches : imageCountMatches;
  const counts = uniqueNumbers(countMatches.map((match) => Number(match.groups[0])));
  if (counts.length > 1) {
    addError(
      "quantity",
      `提示词中存在多个生成数量（${counts.join("、")}）。请只保留一个。`,
      errors,
      errorsByKey,
    );
  } else if (counts.length === 1) {
    const count = counts[0]!;
    if (count < 1 || count > 9) {
      addError(
        "quantity",
        `生成数量必须在 1 到 9 之间，当前识别为 ${count}。`,
        errors,
        errorsByKey,
      );
    } else if (storyboard && !STORYBOARD_COUNTS.has(count)) {
      addError(
        "quantity",
        `分镜数量支持 3、4、6 或 9 个镜头，当前识别为 ${count}。也可以删除数量，让系统自动规划。`,
        errors,
        errorsByKey,
      );
    } else if (storyboard) {
      patch.mode = "storyboard";
      patch.storyboardQuantity = count;
      directives.push({ key: "quantity", label: `${count} 个镜头` });
    } else if (patch.mode === "batch" && count < 2) {
      addError(
        "quantity",
        "多图模式至少需要 2 张图片。请将数量改为 2 到 9，或切换为单图。",
        errors,
        errorsByKey,
      );
    } else if (patch.mode === "single" && count > 1) {
      addError(
        "quantity",
        "提示词同时要求单图和多张结果。请删除其中一个要求。",
        errors,
        errorsByKey,
      );
    } else {
      patch.quantity = count;
      patch.mode = count > 1 ? "batch" : "single";
      directives.push({ key: "mode", label: count > 1 ? "多图" : "单图" });
      directives.push({ key: "quantity", label: `${count} 张` });
    }
  }
  addRanges(ranges, [...shotCountMatches, ...imageCountMatches]);

  parseRatioDirective(prompt, patch, directives, errors, errorsByKey, ranges);
  parseQualityDirective(prompt, patch, directives, errors, errorsByKey, ranges);

  const cleanPrompt = removeRanges(prompt, ranges);
  if (directives.length > 0 && !cleanPrompt) {
    addError(
      "mode",
      "已识别生成规格，但还缺少具体的画面或故事内容。",
      errors,
      errorsByKey,
    );
  }

  return {
    cleanPrompt: cleanPrompt || prompt,
    settingsPatch: patch,
    directives: dedupeDirectives(directives),
    errors,
    errorsByKey,
  };
}

const STORYBOARD_COUNTS = new Set([3, 4, 6, 9]);

export function applyPromptSettings(
  settings: GenerationSettings,
  patch: PromptDirectiveResult["settingsPatch"],
): GenerationRequestSettings {
  return { ...settings, ...patch };
}

export function promptDirectiveSuffix(
  result: PromptDirectiveResult,
): string | undefined {
  const { settingsPatch: patch } = result;
  const parts: string[] = [];

  if (patch.mode === "storyboard") {
    parts.push(
      typeof patch.storyboardQuantity === "number"
        ? `生成 ${patch.storyboardQuantity} 个分镜`
        : "分镜模式",
    );
  } else if (patch.mode === "batch") {
    parts.push("多图模式");
    if (patch.quantity) parts.push(`生成 ${patch.quantity} 张图片`);
  } else if (patch.mode === "single") {
    parts.push("单图模式");
  }

  if (patch.size) parts.push(imageSizeLabel(patch.size));
  if (patch.quality) parts.push(qualityDirectiveLabel(patch.quality));

  return parts.length ? `生成规格（仅本次）：${parts.join("，")}。` : undefined;
}

function parseRatioDirective(
  prompt: string,
  patch: PromptDirectiveResult["settingsPatch"],
  directives: PromptDirective[],
  errors: string[],
  errorsByKey: Partial<Record<PromptDirectiveKey, string>>,
  ranges: TextRange[],
): void {
  const ratioMatches = collectMatches(
    prompt,
    /(?<!\d)(\d{1,3})\s*[:：]\s*(\d{1,3})(?!\d)/g,
  );
  const ratios = uniqueStrings(
    ratioMatches.map((match) => `${Number(match.groups[0])}:${Number(match.groups[1])}`),
  );
  const landscapeMatches = collectMatches(prompt, /(?:横屏|横版)(?!\s*(?:显示器|屏幕))/g);
  const portraitMatches = collectMatches(prompt, /(?:竖屏|竖版)/g);
  const squareMatches = collectMatches(prompt, /(?:方图|正方形)(?:画面|图片|构图)?/g);
  const orientationRatios = uniqueStrings([
    ...(landscapeMatches.length ? ["16:9"] : []),
    ...(portraitMatches.length ? ["9:16"] : []),
    ...(squareMatches.length ? ["1:1"] : []),
  ]);

  if (ratios.length > 1) {
    addError(
      "size",
      `提示词中存在多个画面比例（${ratios.join("、")}）。请只保留一个。`,
      errors,
      errorsByKey,
    );
  } else if (orientationRatios.length > 1) {
    addError(
      "size",
      "提示词中的横屏、竖屏或方图要求互相冲突。请只保留一种。",
      errors,
      errorsByKey,
    );
  } else {
    const explicitRatio = ratios[0];
    const orientationRatio = orientationRatios[0];
    if (explicitRatio && orientationRatio) {
      const explicit = resolveGptImage2Ratio(...explicitRatio.split(":").map(Number) as [number, number]);
      const orientation = resolveGptImage2Ratio(...orientationRatio.split(":").map(Number) as [number, number]);
      if (explicit.size && orientation.size) {
        const [explicitWidth, explicitHeight] = explicit.size.split("x").map(Number);
        const [orientationWidth, orientationHeight] = orientation.size.split("x").map(Number);
        if (Math.sign(explicitWidth - explicitHeight) !== Math.sign(orientationWidth - orientationHeight)) {
          addError(
            "size",
            `画面方向与比例 ${explicit.ratio} 冲突，请确认后重试。`,
            errors,
            errorsByKey,
          );
        }
      }
    }

    const ratio = explicitRatio ?? orientationRatio;
    if (ratio && !errorsByKey.size) {
      const [width, height] = ratio.split(":").map(Number);
      const resolved = resolveGptImage2Ratio(width!, height!);
      const preset = PRESET_RATIOS[resolved.ratio];
      directives.push({
        key: "size",
        label: preset ? resolved.ratio : `自定义 · ${resolved.ratio}`,
      });
      if (resolved.error || !resolved.size) {
        addError(
          "size",
          resolved.error ?? "这个比例无法转换为模型支持的尺寸。",
          errors,
          errorsByKey,
        );
      } else {
        patch.size = preset ?? resolved.size;
      }
    }
  }

  addRanges(ranges, [
    ...ratioMatches,
    ...landscapeMatches,
    ...portraitMatches,
    ...squareMatches,
  ]);
}

function parseQualityDirective(
  prompt: string,
  patch: PromptDirectiveResult["settingsPatch"],
  directives: PromptDirective[],
  errors: string[],
  errorsByKey: Partial<Record<PromptDirectiveKey, string>>,
  ranges: TextRange[],
): void {
  const matches = collectMatches(
    prompt,
    /(?:(?:质量|品质|quality)\s*(?:设置为|设为|使用|要|[:：=])?\s*(自动|草稿|标准|精细|低|中|高|auto|low|medium|high)|(自动|草稿|标准|精细|低|中|高|auto|low|medium|high)\s*(?:质量|品质|quality))/gi,
  );
  const values = uniqueStrings(
    matches.map((match) => match.groups.find(Boolean) ?? ""),
  );
  const normalized = uniqueStrings(values.map(normalizeQuality).filter(Boolean));
  if (normalized.length > 1) {
    addError(
      "quality",
      "提示词中存在多个质量要求。请只保留自动、低、中或高中的一种。",
      errors,
      errorsByKey,
    );
  } else if (normalized.length === 1) {
    const quality = normalized[0] as ImageQuality;
    patch.quality = quality;
    directives.push({ key: "quality", label: qualityDirectiveLabel(quality) });
  }
  addRanges(ranges, matches);
}

function normalizeQuality(value: string): string {
  const normalized = value.toLowerCase();
  return {
    auto: "auto",
    low: "low",
    medium: "medium",
    high: "high",
    自动: "auto",
    草稿: "low",
    低: "low",
    标准: "medium",
    中: "medium",
    精细: "high",
    高: "high",
  }[normalized] ?? "";
}

function qualityDirectiveLabel(quality: ImageQuality): string {
  return {
    auto: "自动质量",
    low: "低质量",
    medium: "中等质量",
    high: "高质量",
  }[quality];
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

function addError(
  key: PromptDirectiveKey,
  message: string,
  errors: string[],
  errorsByKey: Partial<Record<PromptDirectiveKey, string>>,
): void {
  if (!errorsByKey[key]) {
    errorsByKey[key] = message;
  }
  if (!errors.includes(message)) {
    errors.push(message);
  }
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
    .replace(/^[\s,，。；;：:]+|[\s,，。；;：:]+$/g, "")
    .replace(/\s*([,，；;。])\s*(?:[,，；;。]\s*)+/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function dedupeDirectives(directives: PromptDirective[]): PromptDirective[] {
  const seen = new Set<string>();
  return directives.filter((directive) => {
    const key = `${directive.key}:${directive.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values.filter(Number.isFinite))];
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function normalizeFullWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (character) =>
    String(character.charCodeAt(0) - 0xff10),
  );
}
