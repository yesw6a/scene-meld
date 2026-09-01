import type {
  GenerationPlan,
  GenerationRequestSettings,
  GenerationSettings,
  ImageQuality,
  PromptDirectiveResult,
} from "../types";
import { normalizeImageQuantity } from "./image-batch";
import { imageRequestLabel } from "./image-sizes";
import { applyPromptSettings } from "./prompt-directives";

export interface ResolvedGenerationSubmission {
  settings: GenerationRequestSettings;
  plan: GenerationPlan;
  summary: string;
  overrideSummary?: string;
}

export function resolveGenerationSubmission(
  settings: GenerationSettings,
  directives: PromptDirectiveResult,
): ResolvedGenerationSubmission {
  const effectiveSettings = applyPromptSettings(settings, directives.settingsPatch);
  const plan = generationPlanFromSettings(effectiveSettings);
  const requestSettings: GenerationRequestSettings = {
    ...effectiveSettings,
    quantity: plan.mode === "batch" ? plan.count : 1,
    storyboardQuantity: plan.mode === "storyboard" ? plan.shotCount : effectiveSettings.storyboardQuantity,
  };

  return {
    settings: requestSettings,
    plan,
    summary: generationSummary(plan, requestSettings),
    overrideSummary: directives.directives.length
      ? `提示词优先，本次使用：${directives.directives.map((item) => item.label).join("、")}。不会修改默认设置。`
      : undefined,
  };
}

export function generationPlanFromSettings(
  settings: Pick<GenerationRequestSettings, "mode" | "quantity" | "storyboardQuantity">,
): GenerationPlan {
  if (settings.mode === "storyboard") {
    return { mode: "storyboard", shotCount: settings.storyboardQuantity };
  }
  if (settings.mode === "batch") {
    return { mode: "batch", count: Math.max(2, normalizeImageQuantity(settings.quantity)) };
  }
  return { mode: "single", count: 1 };
}

export function generationSummary(
  plan: GenerationPlan,
  settings: Pick<GenerationRequestSettings, "size" | "quality">,
): string {
  const specification = `${imageRequestLabel(settings.size)}、${qualityLabel(settings.quality)}、PNG`;
  if (plan.mode === "storyboard") {
    return plan.shotCount === "auto"
      ? `将先自动规划分镜。确认方案后，再按 ${specification} 生成图片。`
      : `将先规划 ${plan.shotCount} 个分镜。确认方案后，再按 ${specification} 生成图片。`;
  }
  if (plan.mode === "batch") {
    return `将生成 ${plan.count} 张相互独立的图片，规格为 ${specification}。`;
  }
  return `将生成 1 张图片，规格为 ${specification}。`;
}

export function qualityLabel(quality: ImageQuality): string {
  return {
    auto: "自动质量",
    low: "低质量",
    medium: "中等质量",
    high: "高质量",
  }[quality];
}
