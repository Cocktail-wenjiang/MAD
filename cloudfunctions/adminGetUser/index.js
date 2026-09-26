const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
async function currentUser() {
  const openid = cloud.getWXContext().OPENID
  const result = await db.collection("users").where({ _openid: openid }).limit(1).get()
  return { openid, user: result.data[0] || null }
}
exports.main = async (event) => {
  const { user } = await currentUser()
  if (!user || user.role !== "admin") return { ok: false, code: "forbidden", user: null }
  if (!event.userId) return { ok: false, code: "missing-user", user: null }
  const result = await db.collection("users").doc(event.userId).get()
  const history = await db.collection("assessments").where({ _openid: result.data._openid, confirmed: true }).orderBy("createdAt", "desc").limit(5).get()
  return { ok: true, user: { ...result.data, history: history.data } }
}
