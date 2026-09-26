const db = uniCloud.database()
async function currentUser(context) {
  const info = uniCloud.getClientInfo ? (uniCloud.getClientInfo() || {}) : {}
  const openid = info.openid || info.unionId || info.clientId || (context && (context.OPENID || context.openid))
  const result = openid ? await db.collection('users').where({_openid: openid}).limit(1).get() : {data: []}
  return {openid, user: result.data[0] || null}
}
exports.main = async (event, context) => { const {openid}=await currentUser(context);const report=event.report||{};if(!openid||!report.confirmed||!Array.isArray(report.scores))return {ok:false,code:'invalid-report'};const data={_openid:openid,video:report.video||{},scores:report.scores,level:report.level||'待测评',tags:report.tags||[],advice:report.advice||'',basis:report.basis||'',confidence:Number(report.confidence||0),source:report.source||'unknown',sourceLabel:report.sourceLabel||'',confirmed:true,createdAt:report.createdAt||Date.now(),confirmedAt:report.confirmedAt||Date.now()};const result=await db.collection('assessments').add({data});return {ok:true,id:result.id} }
