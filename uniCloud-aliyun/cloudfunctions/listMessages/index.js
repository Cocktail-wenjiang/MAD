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

function genConversationId(a, b) {
  return [a, b].sort().join("_");
}

exports.main = async (event, context) => {
  const openid = getOpenid(context);
  if (!openid) return { ok: false, code: "missing-openid", msg: "用户未登录" };

  const { peerOpenid, beforeTime = null, limit = 30 } = event;
  if (!peerOpenid) return { ok: false, code: "missing-peer", msg: "缺少对方ID" };

  const conversationId = genConversationId(openid, peerOpenid);
  const limitNum = Math.min(Math.max(Number(limit) || 30, 1), 100);

  // 构建查询条件
  const where = { conversationId };
  if (beforeTime) {
    where.createdAt = dbCmd.lt(Number(beforeTime));
  }

  // 按时间倒序取最新的（后面再反转，老消息在上）
  const result = await db
    .collection("messages")
    .where(where)
    .orderBy("createdAt", "desc")
    .limit(limitNum)
    .get();

  const messages = result.data.reverse();

  // 标记对方发的消息为已读
  if (messages.length > 0) {
    await db
      .collection("messages")
      .where({
        conversationId,
        toOpenid: openid,
        isRead: false,
      })
      .update({
        data: { isRead: true },
      });
  }

  return {
    ok: true,
    data: messages,
    hasMore: messages.length >= limitNum,
  };
};
