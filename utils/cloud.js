// uniCloud spaceId is an identifier, not a secret. Keep credentials and third-party
// API keys in cloud-function environment variables instead of this client file.
const UNI_CLOUD_ENV_ID = "mp-1e7276be-ea4b-4ae6-8231-c0b390308aca";
let cloudClient = null;

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
  return typeof uniCloud !== "undefined" && Boolean(UNI_CLOUD_ENV_ID);
}
export function initCloud() {
  if (!isCloudConfigured()) return false;
  try {
    const runtime = typeof uniCloud !== "undefined" ? uniCloud : globalThis.uniCloud;
    cloudClient = runtime.init({ provider: "aliyun", spaceId: UNI_CLOUD_ENV_ID }) || runtime;
    return !!cloudClient;
  } catch (e) {
    console.warn("[羽友][uniCloud] init failed", e);
    return false;
  }
}
export function getCloudClient() {
  if (cloudClient) return cloudClient;
  return initCloud() ? cloudClient : null;
}
export function callCloud(name, data = {}) {
  if (!isCloudConfigured()) return Promise.reject(new Error("cloud-not-configured"));
  const client = getCloudClient();
  if (!client || typeof client.callFunction !== "function") {
    return Promise.reject(new Error("cloud-client-unavailable"));
  }
  return client
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
