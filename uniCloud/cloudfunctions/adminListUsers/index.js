const db = uniCloud.database()
async function currentUser(context) {
  const info = uniCloud.getClientInfo ? (uniCloud.getClientInfo() || {}) : {}
  const openid = info.openid || info.unionId || info.clientId || (context && (context.OPENID || context.openid))
  const result = openid ? await db.collection('users').where({_openid: openid}).limit(1).get() : {data: []}
  return {openid, user: result.data[0] || null}
}
exports.main = async (event, context) => { const {user}=await currentUser(context);if(!user||user.role!=='admin')return {ok:false,code:'forbidden',users:[]};const result=await db.collection('users').orderBy('updatedAt','desc').limit(100).get();return {ok:true,users:result.data.map(x=>({...x,roleLabel:x.role==='admin'?'管理员':'普通用户'}))} }
