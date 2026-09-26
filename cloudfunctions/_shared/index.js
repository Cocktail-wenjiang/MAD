const cloud = require("wx-server-sdk")
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command
async function currentUser() {
  const openid = cloud.getWXContext().OPENID
  const result = await db.collection("users").where({ _openid: openid }).limit(1).get()
  return { openid, user: result.data[0] || null }
}
module.exports = { cloud, db, _, currentUser }
