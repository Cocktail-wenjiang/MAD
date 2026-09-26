const UNI_CLOUD_ENV_ID = 'YOUR_UNICLOUD_ENV_ID'
export function isCloudConfigured() { return typeof uniCloud !== 'undefined' && UNI_CLOUD_ENV_ID !== 'YOUR_UNICLOUD_ENV_ID' }
export function initCloud() { if (!isCloudConfigured()) return false; try { uniCloud.init({ provider: 'tcb', spaceId: UNI_CLOUD_ENV_ID }); return true } catch (e) { console.warn('[羽友][uniCloud] init failed', e); return false } }
export function callCloud(name, data = {}) { if (!isCloudConfigured()) return Promise.reject(new Error('cloud-not-configured')); return uniCloud.callFunction({ name, data }).then(res => res && res.result ? res.result : res) }
