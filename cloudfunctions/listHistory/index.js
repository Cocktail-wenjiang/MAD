const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
async function currentUser() {
  const openid = cloud.getWXContext().OPENID
  const result = await db.collection("users").where({ _openid: openid }).limit(1).get()
  return { openid, user: result.data[0] || null }
}
exports.main = async () => {
  const { openid } = await currentUser()
  const result = await db.collection("assessments").where({ _openid: openid, confirmed: true }).orderBy("createdAt", "desc").limit(30).get()
  return { history: result.data }
}
