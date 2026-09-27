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

// 生成会话ID：两个openid按字典序排序后拼接
function genConversationId(a, b) {
  return [a, b].sort().join("_");
}

exports.main = async (event, context) => {
  const fromOpenid = getOpenid(context);
  if (!fromOpenid) return { ok: false, code: "missing-openid", msg: "用户未登录" };

  const { toOpenid, content, type = "text" } = event;

  if (!toOpenid) return { ok: false, code: "missing-to", msg: "缺少接收者" };
  if (!content || !content.trim()) return { ok: false, code: "empty-content", msg: "消息内容不能为空" };
  if (fromOpenid === toOpenid) return { ok: false, code: "self-chat", msg: "不能给自己发消息" };

  const contentTrimmed = content.trim();
  if (contentTrimmed.length > 500) {
    return { ok: false, code: "too-long", msg: "消息内容不能超过500字" };
  }

  // 查询双方昵称
  const [fromRes, toRes] = await Promise.all([
    db.collection("users").where({ _openid: fromOpenid }).limit(1).get(),
    db.collection("users").where({ _openid: toOpenid }).limit(1).get(),
  ]);

  const fromUser = fromRes.data[0];
  const toUser = toRes.data[0];

  if (!toUser) return { ok: false, code: "user-not-found", msg: "对方不存在" };

  const conversationId = genConversationId(fromOpenid, toOpenid);
  const now = Date.now();

  const msgData = {
    conversationId,
    fromOpenid,
    toOpenid,
    content: contentTrimmed,
    type,
    fromNickname: fromUser?.nickname || "羽球新人",
    toNickname: toUser.nickname || "羽球新人",
    isRead: false,
    createdAt: now,
  };

  const result = await db.collection("messages").add({ data: msgData });

  return {
    ok: true,
    message: { _id: result.id, ...msgData },
  };
};
