const CLOUD_ENV_ID = "YOUR_CLOUD_ENV_ID"

function isConfigured() {
  return typeof wx !== "undefined" && wx.cloud && CLOUD_ENV_ID && CLOUD_ENV_ID !== "YOUR_CLOUD_ENV_ID"
}

function initCloud() {
  if (!isConfigured()) return false
  try {
    wx.cloud.init({ env: CLOUD_ENV_ID, traceUser: true })
    return true
  } catch (error) {
    console.warn("[羽友][cloud] init failed", error)
    return false
  }
}

function callCloud(name, data) {
  if (!isConfigured()) return Promise.reject(new Error("cloud-not-configured"))
  return wx.cloud.callFunction({ name, data }).then(result => result && result.result ? result.result : result)
}

module.exports = { CLOUD_ENV_ID, isConfigured, initCloud, callCloud }
