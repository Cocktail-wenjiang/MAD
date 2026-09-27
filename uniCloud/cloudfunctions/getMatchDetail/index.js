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

function formatTime(timestamp) {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${month}月${day}日 ${hours}:${minutes}`;
}

exports.main = async (event, context) => {
  const openid = getOpenid(context);
  const { matchId } = event;

  if (!matchId) return { ok: false, code: "missing-match-id", msg: "缺少活动ID" };

  const result = await db.collection("matches").doc(matchId).get();
  if (!result.data || result.data.length === 0) {
    return { ok: false, code: "match-not-found", msg: "活动不存在" };
  }

  const match = result.data[0];
  const joinedPlayers = match.joinedPlayers || [];

  // 查询报名用户的昵称
  let playerProfiles = [];
  if (joinedPlayers.length > 0) {
    const userRes = await db
      .collection("users")
      .where({ _openid: db.command.in(joinedPlayers) })
      .get();
    playerProfiles = userRes.data.map((u) => ({
      openid: u._openid,
      nickname: u.nickname || "羽球新人",
      level: u.level || "待测评",
    }));
  }

  const joinedCount = joinedPlayers.length;
  const isJoined = openid ? joinedPlayers.includes(openid) : false;
  const isCreator = openid && match.creatorOpenid === openid;

  return {
    ok: true,
    data: {
      ...match,
      joinedCount,
      isJoined,
      isCreator,
      timeText: formatTime(match.startTime),
      endTimeText: formatTime(match.endTime),
      players: playerProfiles,
    },
  };
};
