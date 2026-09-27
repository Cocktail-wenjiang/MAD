import assert from "node:assert/strict";
import test from "node:test";
import { normalizePoseJob, validatePoseVideo } from "../utils/pose-analysis.js";

const file = (overrides = {}) => ({
  tempFilePath: "/tmp/practice.mp4",
  name: "practice.mp4",
  size: 1024,
  duration: 12,
  ...overrides,
});

test("rejects non-MP4 uploads", () => {
  const result = validatePoseVideo(file({ name: "practice.mov" }));
  assert.equal(result.ok, false);
  assert.equal(result.message, "暂只支持 MP4 格式，请重新选择视频。");
});

test("rejects videos larger than 100 MB", () => {
  const result = validatePoseVideo(file({ size: 100 * 1024 * 1024 + 1 }));
  assert.equal(result.ok, false);
  assert.equal(result.message, "视频不能超过 100MB，请压缩后重新上传。");
});

test("rejects videos longer than 60 seconds", () => {
  const result = validatePoseVideo(file({ duration: 60.1 }));
  assert.equal(result.ok, false);
  assert.equal(result.message, "视频时长不能超过 60 秒，请重新选择短视频。");
});

test("normalizes succeeded job outputs and summary", () => {
  const result = normalizePoseJob(
    {
      job_id: "pose-123",
      status: "succeeded",
      outputs: {
        video_url: "/api/v1/pose/jobs/pose-123/video",
        frames_url: "/api/v1/pose/jobs/pose-123/frames",
      },
      summary: { frame_count: 120, player_count_max: 2, avg_confidence: 0.91 },
    },
    { baseUrl: "https://pose.example.test", apiKey: "secret" }
  );
  assert.equal(result.status, "success");
  assert.equal(result.videoUrl, "https://pose.example.test/api/v1/pose/jobs/pose-123/video");
  assert.equal(result.framesUrl, "https://pose.example.test/api/v1/pose/jobs/pose-123/frames");
  assert.deepEqual(result.summary, { frame_count: 120, player_count_max: 2, avg_confidence: 0.91 });
});

test("preserves server failure message", () => {
  const result = normalizePoseJob({
    job_id: "pose-456",
    status: "failed",
    error: { code: "model_unavailable", message: "模型权重不可用" },
  });
  assert.equal(result.status, "error");
  assert.equal(result.errorMessage, "模型权重不可用");
});
