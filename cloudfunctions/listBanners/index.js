const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
async function currentUser() {
  const openid = cloud.getWXContext().OPENID
  const result = await db.collection("users").where({ _openid: openid }).limit(1).get()
  return { openid, user: result.data[0] || null }
}
exports.main = async () => {
  const now = new Date()
  const result = await db.collection("banners").where({ enabled: true }).orderBy("sort", "asc").limit(10).get()
  return { banners: result.data.filter(item => (!item.startAt || new Date(item.startAt) <= now) && (!item.endAt || new Date(item.endAt) >= now)) }
}
