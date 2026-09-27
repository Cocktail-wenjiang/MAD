const KEYS = {
  profile: "badminton_friend_profile",
  lastReport: "badminton_friend_last_report",
  history: "badminton_friend_report_history",
  session: "badminton_friend_session",
};
function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}
function read(key, fallback) {
  try {
    const value = uni.getStorageSync(key);
    return value === "" || value == null ? clone(fallback) : value;
  } catch (e) {
    return clone(fallback);
  }
}
function write(key, value) {
  try {
    uni.setStorageSync(key, clone(value));
    return true;
  } catch (e) {
    return false;
  }
}
export function loadProfile(defaultProfile) {
  return { ...clone(defaultProfile), ...read(KEYS.profile, {}) };
}
export function saveProfile(profile) {
  return write(KEYS.profile, profile);
}
export function loadSession() {
  return read(KEYS.session, null);
}
export function saveSession(session) {
  return write(KEYS.session, session);
}
export function clearSession() {
  try {
    uni.removeStorageSync(KEYS.session);
    return true;
  } catch (e) {
    return false;
  }
}
export function loadLastReport() {
  return read(KEYS.lastReport, null);
}
export function loadReportHistory() {
  return read(KEYS.history, []);
}
export function saveReport(report) {
  write(KEYS.lastReport, report);
  const history = read(KEYS.history, []);
  return write(
    KEYS.history,
    [report, ...history.filter((item) => item && item.id !== report.id)].slice(0, 30)
  );
}
export function clearReports() {
  uni.removeStorageSync(KEYS.lastReport);
  uni.removeStorageSync(KEYS.history);
}
