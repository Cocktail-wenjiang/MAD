const app = getApp()
const { loadProfile, saveProfile } = require("../../utils/storage")
const { callCloud } = require("../../utils/cloud")
const { redirectToLogin } = require("../../utils/session")
Page({
  data: { profile: app.globalData.userProfile, editing: false, displayVideoPublic: false },
  onShow() {
    if (!redirectToLogin()) return
    app.globalData.userProfile = loadProfile(app.globalData.userProfile)
    this.setData({ profile: app.globalData.userProfile, displayVideoPublic: app.globalData.userProfile.displayVideoPublic })
  },
  edit() { this.setData({ editing: true }) },
  input(e) { const field = e.currentTarget.dataset.field; this.setData({ [`profile.${field}`]: e.detail.value }) },
  save() {
    const profile = { ...this.data.profile, displayVideoPublic: this.data.displayVideoPublic }
    app.globalData.userProfile = profile
    saveProfile(profile)
    callCloud("syncUser", { profile }).catch(() => null)
    this.setData({ editing: false })
    wx.showToast({ title: "资料已保存", icon: "success" })
  },
  toggleVideo(e) { this.setData({ displayVideoPublic: e.detail.value }) },
  chooseDisplayVideo() { wx.chooseVideo({ sourceType: ["album", "camera"], maxDuration: 60, success: (res) => { this.setData({ "profile.displayVideo": res.tempFilePath }) } }) },
  logout() { app.globalData.session = null; wx.removeStorageSync("badminton_friend_session"); wx.redirectTo({ url: "/pages/login/login" }) }
})
