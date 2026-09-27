import { getPoseApiConfig } from "./cloud.js";

export const MAX_POSE_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_POSE_VIDEO_SECONDS = 60;

const DEFAULT_POLL_INTERVAL_MS = 500;
const MAX_POLL_INTERVAL_MS = 2000;
const DEFAULT_MAX_WAIT_MS = 10 * 60 * 1000;

function serviceError(message = "姿态分析服务不可用，请稍后重试。", cause) {
  const error = new Error(message);
  error.code = "service_unavailable";
  error.fallbackEligible = true;
  if (cause) error.cause = cause;
  return error;
}

function responseError(message, code = "pose_request_failed", statusCode) {
  const error = new Error(message || "姿态分析请求失败，请稍后重试。");
  error.code = code;
  error.statusCode = statusCode;
  error.fallbackEligible = false;
  return error;
}

function apiBaseUrl(config) {
  return String(config?.baseUrl || "").replace(/\/+$/, "");
}

function resolveUrl(value, config) {
  if (!value) return "";
  if (/^(?:https?:|wss?:|data:|blob:)/i.test(value)) return value;
  const base = apiBaseUrl(config);
  if (!base) return value;
  return `${base}/${String(value).replace(/^\/+/, "")}`;
}

function authHeader(config) {
  const key = String(config?.apiKey || "").trim();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

function parseResponseData(data) {
  if (typeof data !== "string") return data || {};
  try {
    return JSON.parse(data);
  } catch {
    return { message: data };
  }
}

function errorMessage(payload, fallback) {
  return payload?.error?.message || payload?.detail?.message || payload?.message || fallback;
}

export function validatePoseVideo(file = {}) {
  const path = file.tempFilePath || file.path || file.filePath || "";
  const name = file.name || file.filename || path.split(/[\\/]/).pop() || "";
  const size = Number(file.size || 0);
  const duration = Number(file.duration || 0);
  if (!path) return { ok: false, code: "empty", message: "没有获取到视频文件，请重新选择。" };
  if (!/\.mp4$/i.test(name))
    return { ok: false, code: "format", message: "暂只支持 MP4 格式，请重新选择视频。" };
  if (size > MAX_POSE_VIDEO_BYTES)
    return { ok: false, code: "size", message: "视频不能超过 100MB，请压缩后重新上传。" };
  if (duration > MAX_POSE_VIDEO_SECONDS)
    return { ok: false, code: "duration", message: "视频时长不能超过 60 秒，请重新选择短视频。" };
  return {
    ok: true,
    code: "ok",
    meta: {
      name,
      size,
      duration,
      path,
      sizeLabel: `${Math.round((size / 1024 / 1024) * 10) / 10 || "<0.1"}MB`,
      durationLabel: `${Math.round(duration * 10) / 10 || 0}秒`,
    },
  };
}

function uploadFile(options) {
  return new Promise((resolve, reject) => {
    if (typeof uni === "undefined" || typeof uni.uploadFile !== "function") {
      reject(serviceError());
      return;
    }
    uni.uploadFile({ ...options, success: resolve, fail: reject });
  });
}

function request(options) {
  return new Promise((resolve, reject) => {
    if (typeof uni === "undefined" || typeof uni.request !== "function") {
      reject(serviceError());
      return;
    }
    uni.request({ ...options, success: resolve, fail: reject });
  });
}

export async function createPoseJob(file, options = {}) {
  const validation = validatePoseVideo(file);
  if (!validation.ok) throw responseError(validation.message, `unsupported_${validation.code}`);
  const config = getPoseApiConfig(options);
  const base = apiBaseUrl(config);
  if (!base) throw serviceError("姿态分析服务尚未配置，请稍后重试。");
  let response;
  try {
    response = await uploadFile({
      url: `${base}/api/v1/pose/jobs`,
      filePath: validation.meta.path,
      name: "file",
      header: authHeader(config),
      formData: { filename: validation.meta.name },
    });
  } catch (cause) {
    throw serviceError(undefined, cause);
  }
  const payload = parseResponseData(response?.data);
  const statusCode = response?.statusCode == null ? 200 : Number(response.statusCode);
  if (statusCode < 200 || statusCode >= 300) {
    throw responseError(
      errorMessage(payload, "创建姿态分析任务失败，请稍后重试。"),
      payload?.error?.code,
      statusCode
    );
  }
  if (!payload?.job_id)
    throw responseError("姿态分析服务返回了无效任务。", "invalid_response", statusCode);
  return normalizePoseJob(payload, config);
}

export function normalizePoseJob(record = {}, config = getPoseApiConfig()) {
  const outputs = record.outputs || {};
  const rawStatus = String(record.status || "").toLowerCase();
  const status =
    rawStatus === "succeeded" ? "success" : rawStatus === "failed" ? "error" : "processing";
  const rawError = record.error || {};
  const summary = record.summary || outputs.summary || null;
  return {
    ...record,
    jobId: record.job_id || record.jobId || "",
    status,
    serverStatus: rawStatus,
    progress: Number(record.progress || 0),
    pollUrl: resolveUrl(record.poll_url || record.pollUrl, config),
    videoUrl: resolveUrl(record.video_url || outputs.video_url || outputs.videoUrl, config),
    framesUrl: resolveUrl(record.frames_url || outputs.frames_url || outputs.framesUrl, config),
    summaryUrl: resolveUrl(record.summary_url || outputs.summary_url || outputs.summaryUrl, config),
    summary,
    error: rawError,
    errorMessage: errorMessage(record, "姿态分析任务失败，请稍后重试。"),
  };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function pollPoseJob(job, options = {}) {
  const config = getPoseApiConfig(options);
  const pollUrl = resolveUrl(job?.poll_url || job?.pollUrl, config);
  if (!pollUrl) throw responseError("姿态分析任务缺少轮询地址。", "invalid_response");
  const startedAt = Date.now();
  let interval = Number(options.initialIntervalMs || DEFAULT_POLL_INTERVAL_MS);
  const maxWaitMs = Number(options.maxWaitMs || DEFAULT_MAX_WAIT_MS);
  while (Date.now() - startedAt <= maxWaitMs) {
    let response;
    try {
      response = await request({ url: pollUrl, method: "GET", header: authHeader(config) });
    } catch (cause) {
      throw serviceError(undefined, cause);
    }
    const payload = parseResponseData(response?.data);
    const statusCode = response?.statusCode == null ? 200 : Number(response.statusCode);
    if (statusCode < 200 || statusCode >= 300) {
      throw responseError(
        errorMessage(payload, "查询姿态分析任务失败，请稍后重试。"),
        payload?.error?.code,
        statusCode
      );
    }
    const normalized = normalizePoseJob(payload, config);
    if (normalized.status === "success") return normalized;
    if (normalized.status === "error") {
      throw responseError(normalized.errorMessage, normalized.error?.code || "pose_job_failed");
    }
    await sleep(interval);
    interval = Math.min(MAX_POLL_INTERVAL_MS, interval * 2);
  }
  throw responseError("姿态分析超时，请稍后重试。", "timeout");
}

export async function analyzePoseVideo(file, options = {}) {
  const created = await createPoseJob(file, options);
  return pollPoseJob(created, options);
}
