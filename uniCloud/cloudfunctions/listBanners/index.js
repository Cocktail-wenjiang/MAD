const db = uniCloud.database()
async function currentUser(context) {
  const info = uniCloud.getClientInfo ? (uniCloud.getClientInfo() || {}) : {}
  const openid = info.openid || info.unionId || info.clientId || (context && (context.OPENID || context.openid))
  const result = openid ? await db.collection('users').where({_openid: openid}).limit(1).get() : {data: []}
  return {openid, user: result.data[0] || null}
}
exports.main = async (event, context) => { const result=await db.collection('banners').where({enabled:true}).orderBy('sort','asc').limit(10).get();return {banners:result.data} }
