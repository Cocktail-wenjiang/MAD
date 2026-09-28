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

  const { latitude, longitude, region = "" } = event;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return { ok: false, code: "invalid-location", msg: "位置参数错误" };
  }

  const now = Date.now();
  const data = {
    latitude,
    longitude,
    locationUpdatedAt: now,
    updatedAt: now,
  };

  // 如果传了地区也一起更新
  if (region) {
    data.region = region;
  }

  // 更新用户位置
  const result = await db
    .collection("users")
    .where({ _openid: openid })
    .update({ data });

  if (result.updated === 0) {
    // 用户不存在，创建一个
    await db.collection("users").add({
      data: {
        _openid: openid,
        nickname: "羽球新人",
        role: "user",
        ...data,
        createdAt: now,
      },
    });
  }

  return { ok: true, latitude, longitude };
};
