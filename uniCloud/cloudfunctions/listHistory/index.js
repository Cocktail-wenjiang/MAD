const db = uniCloud.database();
async function currentUser(context) {
  const info = uniCloud.getClientInfo ? uniCloud.getClientInfo() || {} : {};
  const openid =
    info.openid || info.unionId || info.clientId || (context && (context.OPENID || context.openid));
  const result = openid
    ? await db.collection("users").where({ _openid: openid }).limit(1).get()
    : { data: [] };
  return { openid, user: result.data[0] || null };
}
exports.main = async (event, context) => {
  const { openid } = await currentUser(context);
  if (!openid) return { ok: false, code: "missing-openid", history: [] };
  const result = await db
    .collection("assessments")
    .where({ _openid: openid, confirmed: true })
    .orderBy("createdAt", "desc")
    .limit(30)
    .get();
  return { history: result.data };
};
