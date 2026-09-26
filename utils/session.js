const app = getApp()

function currentSession() {
  return app && app.globalData ? app.globalData.session : null
}

function isLoggedIn() {
  return !!currentSession()
}

function redirectToLogin() {
  if (!isLoggedIn()) {
    wx.redirectTo({ url: "/pages/login/login" })
    return false
  }
  return true
}

module.exports = { currentSession, isLoggedIn, redirectToLogin }
