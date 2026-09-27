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

  // 查找所有和当前用户相关的消息（发的或收的），按 conversationId 分组
  // 注意：uniCloud 不支持聚合 group，所以用另一种方式：
  // 先查所有涉及我的消息，按 conversationId + createdAt 排序，然后在代码里去重

  const limit = 200; // 取最近200条来聚合会话
  const result = await db
    .collection("messages")
    .where(dbCmd.or([{ fromOpenid: openid }, { toOpenid: openid }]))
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  // 按 conversationId 去重，保留最新的一条
  const conversationMap = new Map();
  for (const msg of result.data) {
    if (!conversationMap.has(msg.conversationId)) {
      conversationMap.set(msg.conversationId, msg);
    }
  }

  // 构造会话列表
  const conversations = [];
  for (const msg of conversationMap.values()) {
    const peerOpenid = msg.fromOpenid === openid ? msg.toOpenid : msg.fromOpenid;
    const peerNickname = msg.fromOpenid === openid ? msg.toNickname : msg.fromNickname;
    const isMine = msg.fromOpenid === openid;

    // 计算未读数
    const unreadRes = await db
      .collection("messages")
      .where({
        conversationId: msg.conversationId,
        toOpenid: openid,
        isRead: false,
      })
      .count();

    conversations.push({
      conversationId: msg.conversationId,
      peerOpenid,
      peerNickname,
      lastMessage: msg.content,
      lastMessageTime: msg.createdAt,
      lastMessageIsMine: isMine,
      unreadCount: unreadRes.total,
    });
  }

  // 按最后消息时间倒序
  conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

  return {
    ok: true,
    data: conversations,
    total: conversations.length,
  };
};
