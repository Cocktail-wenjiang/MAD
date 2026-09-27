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

  const { title, place, latitude, longitude, startTime, endTime, level, maxPlayers, note } = event;

  // 基本校验
  if (!title || !place || !latitude || !longitude || !startTime || !level) {
    return { ok: false, code: "missing-fields", msg: "缺少必要字段" };
  }
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return { ok: false, code: "invalid-location", msg: "位置信息格式错误" };
  }
  if (startTime < Date.now() - 60 * 1000) {
    return { ok: false, code: "invalid-time", msg: "活动时间不能早于当前时间" };
  }

  // 获取用户信息
  const userRes = await db.collection("users").where({ _openid: openid }).limit(1).get();
  const user = userRes.data[0];

  const now = Date.now();
  const matchData = {
    title,
    place,
    latitude,
    longitude,
    startTime,
    endTime: endTime || startTime + 2 * 60 * 60 * 1000, // 默认2小时
    level,
    maxPlayers: maxPlayers || 4,
    joinedPlayers: [openid],
    creatorOpenid: openid,
    creatorNickname: user?.nickname || "羽球新人",
    note: note || "",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  const result = await db.collection("matches").add({ data: matchData });

  return {
    ok: true,
    id: result.id,
    match: { _id: result.id, ...matchData },
  };
};
