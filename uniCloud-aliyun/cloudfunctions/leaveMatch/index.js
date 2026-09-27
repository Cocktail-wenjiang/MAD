const db = uniCloud.database();
const dbCmd = db.command;

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

  const { matchId } = event;
  if (!matchId) return { ok: false, code: "missing-match-id", msg: "缺少活动ID" };

  // 查询活动
  const matchRes = await db.collection("matches").doc(matchId).get();
  if (!matchRes.data || matchRes.data.length === 0) {
    return { ok: false, code: "match-not-found", msg: "活动不存在" };
  }
  const match = matchRes.data[0];

  const joined = match.joinedPlayers || [];
  if (!joined.includes(openid)) {
    return { ok: false, code: "not-joined", msg: "你还没有报名" };
  }

  // 不能退出自己创建的活动（可以取消活动）
  if (match.creatorOpenid === openid && joined.length > 1) {
    // 发起人可以退出，但需要转让？这里简单处理：允许退出
  }

  // 移除
  const newJoined = joined.filter((id) => id !== openid);
  await db.collection("matches").doc(matchId).update({
    data: {
      joinedPlayers: newJoined,
      updatedAt: Date.now(),
    },
  });

  return {
    ok: true,
    joinedCount: newJoined.length,
    maxPlayers: match.maxPlayers || 4,
  };
};
