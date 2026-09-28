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
  const { openid, user } = await currentUser(context);
  if (!openid) return { ok: false, code: "missing-openid" };
  const p = event.profile || {};
  const data = {
    nickname: p.nickname || "羽球新人",
    region: p.region || "",
    availability: p.availability || "",
    level: p.level || "待测评",
    tags: Array.isArray(p.tags) ? p.tags : [],
    displayVideoPublic: !!p.displayVideoPublic,
    updatedAt: Date.now(),
  };
  if (!user) {
    data.role = "user";
    data.createdAt = Date.now();
    await db.collection("users").add({ data: { _openid: openid, ...data } });
  } else await db.collection("users").doc(user._id).update({ data });
  return { ok: true, role: user?.role || "user" };
};
