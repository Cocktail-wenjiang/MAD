const app = getApp()
const { saveProfile, saveSession } = require("../../utils/storage")
const { callCloud } = require("../../utils/cloud")

const USER_ACCOUNT = { role: "user", nickname: "羽球新人", region: "武汉", availability: "周末晚上" }
const INITIAL_ADMIN_ACCOUNT = { username: "admin", password: "admin123", role: "admin", nickname: "羽友管理员", region: "武汉", availability: "工作日 18:00 后" }

Page({
  data: { mode: "user", adminUsername: "", adminPassword: "", error: "" },

  openAdminLogin() { this.setData({ mode: "admin", error: "" }) },
  backToUserLogin() { this.setData({ mode: "user", adminUsername: "", adminPassword: "", error: "" }) },
  inputAdminUsername(e) { this.setData({ adminUsername: e.detail.value, error: "" }) },
  inputAdminPassword(e) { this.setData({ adminPassword: e.detail.value, error: "" }) },
  confirmUserLogin() { this.completeLogin(USER_ACCOUNT) },

  confirmAdminLogin() {
    if (this.data.adminUsername !== INITIAL_ADMIN_ACCOUNT.username || this.data.adminPassword !== INITIAL_ADMIN_ACCOUNT.password) return this.setData({ error: "管理员账号或密码不正确。" })
    this.completeLogin(INITIAL_ADMIN_ACCOUNT)
  },

  completeLogin(account) {
    const session = { role: account.role, nickname: account.nickname, username: account.username || "demo-user", loggedInAt: new Date().toISOString() }
    const profile = { ...app.globalData.userProfile, nickname: account.nickname, region: account.region, availability: account.availability }
    app.globalData.session = session
    app.globalData.userProfile = profile
    saveSession(session)
    saveProfile(profile)
    callCloud("syncUser", { profile, role: account.role }).catch(() => null)
    wx.switchTab({ url: "/pages/index/index" })
  }
})
