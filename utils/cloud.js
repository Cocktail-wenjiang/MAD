const UNI_CLOUD_ENV_ID = "mp-1e7276be-ea4b-4ae6-8231-c0b390308aca";
const UNI_CLOUD_PROVIDER = "aliyun";
let cloudInitialized = false;

function readRuntimePoseConfig() {
  if (typeof globalThis === "undefined") return {};
  const config = globalThis.__YUYOU_CONFIG__ || globalThis.__BADMINTON_FRIEND_CONFIG__;
  return config && typeof config === "object" ? config : {};
}

function readBuildPoseConfig() {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  return {
    baseUrl: env.VITE_POSE_API_BASE_URL || env.UNI_APP_POSE_API_BASE_URL || "",
    apiKey: env.VITE_POSE_API_KEY || env.UNI_APP_POSE_API_KEY || "",
  };
}

export function isCloudConfigured() {
  return typeof uniCloud !== "undefined" && UNI_CLOUD_ENV_ID !== "YOUR_UNICLOUD_ENV_ID";
}

/**
 * 初始化 uniCloud。
 * 不要手动调用 uniCloud.init()——HBuilderX 已通过 manifest.json / .unicloud
 * 自动完成初始化（包含 clientSecret），手动再 init 会因缺少 clientSecret 而失败，
 * 并覆盖 HBuilderX 的自动关联，导致后续所有云函数调用报「应用未关联服务空间」。
 */
export function initCloud() {
  if (cloudInitialized) return true;
  if (!isCloudConfigured()) {
    console.warn("[羽友][uniCloud] uniCloud 不可用，请在 HBuilderX 中关联服务空间");
    return false;
  }
  cloudInitialized = true;
  return true;
}

export function callCloud(name, data = {}) {
  if (!isCloudConfigured()) return Promise.reject(new Error("cloud-not-configured"));
  return uniCloud
    .callFunction({ name, data })
    .then((res) => (res && res.result ? res.result : res));
}

export function uploadFile(options = {}) {
  if (!isCloudConfigured()) return Promise.reject(new Error("cloud-not-configured"));
  return uniCloud.uploadFile({
    cloudPath: options.cloudPath,
    filePath: options.filePath,
  });
}

export function getPoseApiConfig(overrides = {}) {
  const build = readBuildPoseConfig();
  const runtime = readRuntimePoseConfig();
  return {
    baseUrl: overrides.baseUrl ?? runtime.poseApiBaseUrl ?? runtime.poseApiBaseURL ?? build.baseUrl,
    apiKey: overrides.apiKey ?? runtime.poseApiKey ?? build.apiKey,
  };
}
