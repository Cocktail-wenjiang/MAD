const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
async function currentUser() {
  const openid = cloud.getWXContext().OPENID
  const result = await db.collection("users").where({ _openid: openid }).limit(1).get()
  return { openid, user: result.data[0] || null }
}
exports.main = async () => {
  const { user } = await currentUser()
  if (!user || user.role !== "admin") return { ok: false, code: "forbidden", users: [] }
  const result = await db.collection("users").orderBy("updatedAt", "desc").limit(100).get()
  return { ok: true, users: result.data.map(item => ({ ...item, roleLabel: item.role === "admin" ? "管理员" : "普通用户" })) }
}
