const app = getApp()
const { validateVideo } = require("../../utils/validation")
const { runAnalysis } = require("../../utils/analysis-adapter")
const { loadLastReport, saveProfile, saveReport, clearReports } = require("../../utils/storage")
const { decorateReport } = require("../../utils/report")
const { callCloud } = require("../../utils/cloud")
const { redirectToLogin } = require("../../utils/session")

Page({
  data: {
    status: "idle",
    videoName: "",
    videoMeta: "",
    result: null,
    error: "",
    restored: false
  },

  onShow() {
    if (!redirectToLogin()) return
    if (this.data.status === "idle" && !this.data.result) this.restoreLastReport()
  },

  restoreLastReport() {
    const report = loadLastReport()
    if (!report) return
    const decorated = decorateReport(report)
    this.setData({ status: "success", result: decorated, videoName: decorated.video.name, videoMeta: `${decorated.video.size ? Math.round(decorated.video.size / 1024 / 1024 * 10) / 10 : "<0.1"}MB · ${decorated.video.duration || 0}秒`, restored: true })
    console.info("[羽友][assessment] restored report", decorated.id)
  },

  chooseVideo() {
    wx.chooseVideo({ sourceType: ["album", "camera"], compressed: false, maxDuration: 60, camera: "back", success: (file) => {
      const validation = validateVideo(file)
      if (!validation.ok) {
        console.warn("[羽友][assessment] validation rejected", validation.code)
        return this.setData({ status: "error", error: validation.message, result: null, restored: false })
      }
      const meta = validation.meta
      this.setData({ status: "processing", videoName: meta.name, videoMeta: `${meta.sizeLabel} · ${meta.durationLabel || "最长60秒"}`, error: "", result: null, restored: false })
      console.info("[羽友][assessment] analysis started", meta.name)
      this.runDemoAnalysis(meta)
    }, fail: () => {
      console.info("[羽友][assessment] choose cancelled")
      this.setData({ status: "idle", error: "" })
    } })
  },

  runDemoAnalysis(meta) {
    runAnalysis(meta).then(report => {
      const decorated = decorateReport(report)
      console.info("[羽友][assessment] analysis completed", decorated.source, decorated.confidence)
      this.setData({ status: "success", result: decorated })
    }).catch(error => {
      console.error("[羽友][assessment] analysis failed", error)
      this.setData({ status: "error", error: "分析暂时不可用，请稍后重试。", result: null })
    })
  },

  confirmResult() {
    const result = this.data.result
    if (!result || result.confirmed) return
    const nextResult = { ...result, confirmed: true, confirmedAt: new Date().toISOString() }
    const profile = { ...app.globalData.userProfile, level: result.level, tags: result.tags }
    app.globalData.userProfile = profile
    saveProfile(profile)
    saveReport(nextResult)
    callCloud("saveAssessment", { report: nextResult }).catch(() => null)
    this.setData({ result: decorateReport(nextResult), restored: false })
    console.info("[羽友][assessment] report confirmed", nextResult.id)
    wx.showToast({ title: "已保存到我的资料", icon: "success" })
  },

  clearLastReport() {
    clearReports()
    this.setData({ status: "idle", error: "", result: null, videoName: "", videoMeta: "", restored: false })
    wx.showToast({ title: "已清除最近报告", icon: "success" })
  },

  retry() { this.setData({ status: "idle", error: "", result: null, videoName: "", videoMeta: "", restored: false }) }
})
