const { loadProfile, loadSession } = require("./utils/storage")
const { initCloud } = require("./utils/cloud")

App({
  globalData: {
    userProfile: {
      nickname: "羽球新人",
      region: "武汉",
      availability: "周末晚上",
      level: "待测评",
      tags: ["等待首次测评"],
      displayVideo: "",
      displayVideoPublic: false
    },
    session: null,
    cloudReady: false
  },
  onLaunch() {
    this.globalData.userProfile = loadProfile(this.globalData.userProfile)
    this.globalData.session = loadSession()
    this.globalData.cloudReady = initCloud()
  }
})
