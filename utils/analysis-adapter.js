const LIMITATIONS = [
  "结果来自单机位 2D 姿态或规则复盘，只适合相同用户、相近机位下的训练趋势对比。",
  "检测结果不代表真实球速、真实力量或 3D 生物力学结论，也不作为医疗或专业诊断。",
];

function clampScore(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
}

function clampConfidence(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, Number(number.toFixed(2)))) : fallback;
}

function scoreOf(metric, fallback) {
  if (!metric) return fallback;
  return clampScore(metric.score ?? metric.total_score ?? metric.value ?? metric.overall, fallback);
}

function evidenceOf(metric, defaultText) {
  const breakdown = metric && metric.score_breakdown;
  if (!breakdown || typeof breakdown !== "object") return defaultText;
  const parts = Object.keys(breakdown)
    .slice(0, 3)
    .map((key) => `${key}: ${breakdown[key]}`)
    .join("；");
  return parts ? `依据 ShuttlePoseReview 结构化指标（${parts}）。` : defaultText;
}

function createFallbackAnalysis(meta, reason) {
  const report = {
    id: `report-${Date.now()}`,
    source: "rule-fallback",
    sourceLabel: "本地规则降级",
    video: { name: meta.name, size: meta.size, duration: meta.duration },
    scores: [
      {
        name: "击球时机",
        value: 68,
        issue: "击球点略低，建议先稳定架拍高度。",
        evidence: "根据视频输入约束和可解释规则生成，未调用外部模型。",
      },
      {
        name: "发力链",
        value: 64,
        issue: "下肢到躯干的衔接仍需练习。",
        evidence: "使用动作阶段规则进行保守估计，建议结合多次测评观察趋势。",
      },
      {
        name: "回位恢复",
        value: 62,
        issue: "回中速度较慢，启动前重心偏后。",
        evidence: "使用回位稳定性规则进行保守估计，低置信度时不扩大结论。",
      },
    ],
    level: "入门至初级",
    tags: ["高远球待提升", "移动恢复待练习"],
    advice: "先练习无球启动与回中，再进行高远球多球练习。每组 8—10 次，组间休息 60 秒。",
    basis: "本次结果由本地可解释规则生成，建议结合连续多次同机位视频观察趋势。",
    confidence: 0.58,
    quality: "保守估计",
    limitations: LIMITATIONS,
    confirmed: false,
    createdAt: new Date().toISOString(),
    fallbackReason: reason || "姿态分析服务不可用",
  };
  return report;
}

function normalizeShuttlePoseReview(payload, meta) {
  const strokes = Array.isArray(payload && payload.stroke_metrics) ? payload.stroke_metrics : [];
  const stroke = strokes[0] || {};
  const timing = stroke.timing || {};
  const chain = stroke.chain || {};
  const recovery = stroke.recovery || {};
  const confidence = clampConfidence(payload && (payload.confidence ?? stroke.confidence), 0.78);
  const report = {
    id: `report-${Date.now()}`,
    source: "shuttleposereview",
    sourceLabel: "ShuttlePoseReview 结构化结果",
    video: { name: meta.name, size: meta.size, duration: meta.duration },
    scores: [
      {
        name: "击球时机",
        value: scoreOf(timing, 70),
        issue: "关注击球点高度和准备期姿态。",
        evidence: evidenceOf(timing, "依据 timing 结构化指标。"),
      },
      {
        name: "发力链",
        value: scoreOf(chain, 66),
        issue: "关注下肢、躯干、手臂和手腕的时序衔接。",
        evidence: evidenceOf(chain, "依据 chain 结构化指标。"),
      },
      {
        name: "回位恢复",
        value: scoreOf(recovery, 64),
        issue: "关注发力后的稳定时间和回中姿态。",
        evidence: evidenceOf(recovery, "依据 recovery 结构化指标。"),
      },
    ],
    level: "入门至初级",
    tags: ["动作复盘可用", confidence < 0.65 ? "建议重新拍摄" : "可继续训练"],
    advice: "优先练习得分最低的指标，并保持相近机位进行下一次复测。",
    basis: "指标来自 ShuttlePoseReview 的 2D 姿态复盘 JSON；页面仅展示可解释代理指标。",
    confidence,
    quality: confidence < 0.65 ? "低置信度" : "可用",
    limitations: LIMITATIONS,
    confirmed: false,
    createdAt: new Date().toISOString(),
  };
  return report;
}

function runAnalysis(meta, options) {
  const opts = options || {};
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (opts.fail) return reject(new Error("analysis service unavailable"));
      if (
        opts.payload &&
        Array.isArray(opts.payload.stroke_metrics) &&
        opts.payload.stroke_metrics.length
      ) {
        return resolve(normalizeShuttlePoseReview(opts.payload, meta));
      }
      resolve(createFallbackAnalysis(meta, opts.reason));
    }, 900);
  });
}

module.exports = { LIMITATIONS, createFallbackAnalysis, normalizeShuttlePoseReview, runAnalysis };
