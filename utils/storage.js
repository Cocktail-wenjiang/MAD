const KEYS = {
  profile: "badminton_friend_profile",
  lastReport: "badminton_friend_last_report",
  history: "badminton_friend_report_history",
  session: "badminton_friend_session"
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function read(key, fallback) {
  try {
    const value = wx.getStorageSync(key)
    return value === "" || value == null ? clone(fallback) : value
  } catch (error) {
    console.warn("[羽友][storage] read failed", key, error)
    return clone(fallback)
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(key, clone(value))
    return true
  } catch (error) {
    console.warn("[羽友][storage] write failed", key, error)
    return false
  }
}

function loadProfile(defaultProfile) {
  return { ...clone(defaultProfile), ...read(KEYS.profile, {}) }
}

function saveProfile(profile) {
  return write(KEYS.profile, profile)
}

function loadLastReport() {
  return read(KEYS.lastReport, null)
}

function loadReportHistory() {
  return read(KEYS.history, [])
}

function loadSession() {
  return read(KEYS.session, null)
}

function saveSession(session) {
  return write(KEYS.session, session)
}

function clearSession() {
  try {
    wx.removeStorageSync(KEYS.session)
    return true
  } catch (error) {
    console.warn("[羽友][storage] session clear failed", error)
    return false
  }
}

function saveReport(report) {
  const saved = write(KEYS.lastReport, report)
  const history = read(KEYS.history, [])
  const next = [report, ...history.filter(item => item && item.id !== report.id)].slice(0, 10)
  write(KEYS.history, next)
  return saved
}

function clearReports() {
  try {
    wx.removeStorageSync(KEYS.lastReport)
    wx.removeStorageSync(KEYS.history)
    return true
  } catch (error) {
    console.warn("[羽友][storage] clear failed", error)
    return false
  }
}

module.exports = { KEYS, loadProfile, saveProfile, loadLastReport, loadReportHistory, saveReport, clearReports, loadSession, saveSession, clearSession }
