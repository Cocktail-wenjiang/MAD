const UNI_CLOUD_ENV_ID = "YOUR_UNICLOUD_ENV_ID";

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
export function initCloud() {
  if (!isCloudConfigured()) return false;
  try {
    uniCloud.init({ provider: "tcb", spaceId: UNI_CLOUD_ENV_ID });
    return true;
  } catch (e) {
    console.warn("[羽友][uniCloud] init failed", e);
    return false;
  }
}
export function callCloud(name, data = {}) {
  if (!isCloudConfigured()) return Promise.reject(new Error("cloud-not-configured"));
  return uniCloud
    .callFunction({ name, data })
    .then((res) => (res && res.result ? res.result : res));
}

export function getPoseApiConfig(overrides = {}) {
  const build = readBuildPoseConfig();
  const runtime = readRuntimePoseConfig();
  return {
    baseUrl: overrides.baseUrl ?? runtime.poseApiBaseUrl ?? runtime.poseApiBaseURL ?? build.baseUrl,
    apiKey: overrides.apiKey ?? runtime.poseApiKey ?? build.apiKey,
  };
}
