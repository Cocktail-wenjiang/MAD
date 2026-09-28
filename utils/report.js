function confidenceLabel(value) {
  const confidence = Number(value || 0);
  if (confidence >= 0.8) return "较高";
  if (confidence >= 0.65) return "中等";
  return "较低";
}

function sourceLabel(source) {
  if (source === "shuttleposereview") return "ShuttlePoseReview 结构化结果";
  if (source === "rule-fallback") return "本地规则降级";
  return "演示结果";
}

function decorateReport(report) {
  if (!report) return null;
  return {
    ...report,
    sourceLabel: report.sourceLabel || sourceLabel(report.source),
    confidenceLabel: confidenceLabel(report.confidence),
    scoreAverage: Math.round(
      report.scores.reduce((sum, item) => sum + Number(item.value || 0), 0) /
        Math.max(1, report.scores.length)
    ),
  };
}

module.exports = { confidenceLabel, sourceLabel, decorateReport };
