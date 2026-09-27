const db = uniCloud.database();

function getOpenid(context) {
  const info = uniCloud.getClientInfo ? uniCloud.getClientInfo() || {} : {};
  return (
    info.openid ||
    info.unionId ||
    info.clientId ||
    (context && (context.OPENID || context.openid)) ||
    ""
  );
}

exports.main = async (event, context) => {
  const openid = getOpenid(context);
  if (!openid) return { ok: false, code: "missing-openid", msg: "用户未登录" };

  const userRes = await db.collection("users").where({ _openid: openid }).limit(1).get();
  const user = userRes.data[0];

  return {
    ok: true,
    openid,
    nickname: user?.nickname || "羽球新人",
    level: user?.level || "待测评",
  };
};
