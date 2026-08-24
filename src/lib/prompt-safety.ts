import type { PromptOptimizationRiskLevel } from "../types";

export interface PromptSafetyReview {
  riskLevel: PromptOptimizationRiskLevel;
  findings: string[];
}

const MINOR_CONTEXT = /(?:未成年|儿童|幼童|小孩|男童|女童|学童|少年|少女|男孩|女孩|underage|minor|child|kid|teen(?:ager)?)/iu;
const EXPLICIT_SEXUAL_CONTENT = /(?:色情|情色|性行为|性交|口交|强奸|猥亵|性挑逗|性暗示|生殖器|全裸|裸体|乳房裸露|porn(?:ographic)?|explicit sex|sexual act|intercourse|oral sex|rape|molest|genitals?|fully nude|naked)/iu;
const GRAPHIC_INJURY = /(?:肢解|开膛|断肢|内脏外露|脑浆|血肉模糊|喷溅鲜血|剥皮|分尸|graphic gore|dismember(?:ed|ment)?|disembowel(?:ed|ment)?|exposed organs?|blood splatter|flayed)/iu;
const ILLEGAL_SUBJECT = /(?:炸弹|爆炸物|自制枪械|毒品|冰毒|甲基苯丙胺|伪造证件|盗取账号|入侵账户|绕过门禁|bomb|explosive device|homemade gun|methamphetamine|fake (?:passport|id)|steal (?:an )?account|hack (?:an )?account|bypass (?:a )?lock)/iu;
const ACTIONABLE_DETAIL = /(?:教程|步骤|配方|制作方法|操作说明|详细过程|如何制作|如何实施|how to|step[- ]by[- ]step|recipe|instructions?|detailed process)/iu;
const BODY_VISIBILITY = /(?:裸露|裸肤|赤裸|裸体|露出[^，。,.]{0,10}(?:皮肤|身体|胸|腿|腰|臀)|exposed skin|bare skin|nude|naked|uncovered (?:body|chest|leg|thigh|waist|hip))/iu;
const REALISTIC_SKIN_DETAIL = /(?:真实皮肤|皮肤毛孔|毛孔细节|汗毛|皮肤褶皱|逼真肤质|写实肤质|photorealistic skin|realistic skin|skin pores?|fine body hair|skin folds?)/iu;
const BODY_CONTACT = /(?:按压|抚摸|揉捏|触摸|摩擦|紧贴|手指[^，。,.]{0,8}(?:接触|按|压|摸)|双手[^，。,.]{0,8}(?:按|压|扶|摸)|press(?:ing)?|touch(?:ing)?|rub(?:bing)?|caress(?:ing)?|hands?[^,.]{0,12}(?:on|against) (?:the )?(?:skin|body|leg|thigh|chest|hip))/iu;
const BODY_REGION = /(?:身体|皮肤|小腿|腿部|大腿|胸部|腰部|臀部|腹部|body|skin|calf|leg|thigh|chest|waist|hip|abdomen)/iu;

export function reviewPromptSafety(prompt: string): PromptSafetyReview {
  const text = prompt.trim();
  if (!text) return { riskLevel: "none", findings: [] };

  const findings = new Set<string>();
  const hasMinorContext = MINOR_CONTEXT.test(text);
  const hasExplicitSexualContent = EXPLICIT_SEXUAL_CONTENT.test(text);

  if (hasMinorContext && hasExplicitSexualContent) {
    findings.add("检测到未成年人语境与性相关内容组合，无法安全保留原始方向。");
    return { riskLevel: "blocked", findings: [...findings] };
  }

  if (hasExplicitSexualContent) {
    findings.add("仍包含露骨或强烈性化表达，需要改成明确非性化的场景。");
  }

  if (GRAPHIC_INJURY.test(text)) {
    findings.add("仍包含写实血腥或严重伤害细节，需要改为非露骨呈现。");
  }

  if (ILLEGAL_SUBJECT.test(text) && ACTIONABLE_DETAIL.test(text)) {
    findings.add("仍包含可执行的违法操作细节，需要删除具体方法和步骤。");
  }

  const hasBodyVisibility = BODY_VISIBILITY.test(text);
  const hasRealisticSkinDetail = REALISTIC_SKIN_DETAIL.test(text);
  const hasBodyContact = BODY_CONTACT.test(text);
  const hasBodyRegion = BODY_REGION.test(text);
  const hasAmbiguousBodyCombination =
    (hasBodyVisibility && hasRealisticSkinDetail && (hasBodyContact || hasBodyRegion)) ||
    (hasRealisticSkinDetail && hasBodyContact && hasBodyRegion);

  if (hasAmbiguousBodyCombination) {
    findings.add("身体暴露、写实皮肤细节与接触动作形成高风险组合，需要改为中性材质或专业练习模型场景。");
  }

  return {
    riskLevel: findings.size ? "review" : "none",
    findings: [...findings],
  };
}
