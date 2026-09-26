const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
async function currentUser() {
  const openid = cloud.getWXContext().OPENID
  const result = await db.collection("users").where({ _openid: openid }).limit(1).get()
  return { openid, user: result.data[0] || null }
}
exports.main = async (event) => {
  const { openid } = await currentUser()
  const report = event.report || {}
  if (!report.confirmed || !Array.isArray(report.scores)) return { ok: false, code: "invalid-report" }
  const data = { _openid: openid, video: report.video || {}, scores: report.scores, level: report.level || "待测评", tags: report.tags || [], advice: report.advice || "", basis: report.basis || "", confidence: Number(report.confidence || 0), source: report.source || "unknown", sourceLabel: report.sourceLabel || "", confirmed: true, createdAt: report.createdAt ? new Date(report.createdAt) : new Date(), confirmedAt: report.confirmedAt ? new Date(report.confirmedAt) : new Date() }
  const result = await db.collection("assessments").add({ data })
  return { ok: true, id: result._id }
}
