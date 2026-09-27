const assert = require("assert");
const { validateVideo } = require("../utils/validation");
const { createFallbackAnalysis, normalizeShuttlePoseReview } = require("../utils/analysis-adapter");

function run(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
  } catch (error) {
    console.error(`[FAIL] ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

run("合法 MP4 通过校验", () => {
  const result = validateVideo({
    tempFilePath: "/tmp/a.mp4",
    size: 10 * 1024 * 1024,
    duration: 30,
  });
  assert.equal(result.ok, true);
});

run("非 MP4 被拒绝", () => {
  const result = validateVideo({ tempFilePath: "/tmp/a.mov", size: 1, duration: 1 });
  assert.equal(result.code, "format");
});

run("超大视频被拒绝", () => {
  const result = validateVideo({
    tempFilePath: "/tmp/a.mp4",
    size: 101 * 1024 * 1024,
    duration: 1,
  });
  assert.equal(result.code, "size");
});

run("超时视频被拒绝", () => {
  const result = validateVideo({ tempFilePath: "/tmp/a.mp4", size: 1, duration: 61 });
  assert.equal(result.code, "duration");
});

run("规则降级结果满足边界", () => {
  const report = createFallbackAnalysis({ name: "a.mp4", size: 1, duration: 1 }, "测试失败");
  assert.equal(report.source, "rule-fallback");
  report.scores.forEach((item) => assert.ok(item.value >= 0 && item.value <= 100));
  assert.ok(report.confidence >= 0 && report.confidence <= 1);
  assert.ok(report.limitations.length >= 2);
});

run("ShuttlePoseReview 结构化结果可归一化", () => {
  const report = normalizeShuttlePoseReview(
    {
      confidence: 0.86,
      stroke_metrics: [
        {
          timing: { score: 80, score_breakdown: { height_score: 95 } },
          chain: { score: 72, score_breakdown: { order_score: 60 } },
          recovery: { score: 66, score_breakdown: { recovery_time_score: 70 } },
        },
      ],
    },
    { name: "a.mp4", size: 1, duration: 1 }
  );
  assert.equal(report.source, "shuttleposereview");
  assert.deepEqual(
    report.scores.map((item) => item.value),
    [80, 72, 66]
  );
});

if (process.exitCode) process.exit(1);
