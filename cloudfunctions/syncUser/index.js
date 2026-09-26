const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
async function currentUser() {
  const openid = cloud.getWXContext().OPENID
  const result = await db.collection("users").where({ _openid: openid }).limit(1).get()
  return { openid, user: result.data[0] || null }
}
exports.main = async (event) => {
  const { openid, user } = await currentUser()
  const profile = event.profile || {}
  const data = { nickname: profile.nickname || "羽球新人", region: profile.region || "", availability: profile.availability || "", level: profile.level || "待测评", tags: Array.isArray(profile.tags) ? profile.tags : [], displayVideoPublic: !!profile.displayVideoPublic, updatedAt: new Date() }
  if (!user) { data.role = "user"; data.createdAt = new Date(); await db.collection("users").add({ data: { _openid: openid, ...data } }) }
  else await db.collection("users").doc(user._id).update({ data })
  return { ok: true, role: user && user.role ? user.role : "user" }
}
