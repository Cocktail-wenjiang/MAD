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

// Haversine 公式计算两点间距离（单位：公里）
function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getLatLonRange(latitude, longitude, radiusKm) {
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));
  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLon: longitude - lonDelta,
    maxLon: longitude + lonDelta,
  };
}

exports.main = async (event, context) => {
  const myOpenid = getOpenid(context);
  const { latitude, longitude, radius = 10, limit = 50, level = null } = event;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return { ok: false, code: "invalid-location", msg: "位置参数错误" };
  }

  const radiusKm = Math.min(Math.max(Number(radius) || 10, 1), 100);
  const limitNum = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const range = getLatLonRange(latitude, longitude, radiusKm);

  // 查询条件：位置范围内 + 有经纬度 + 不是自己
  const where = {
    latitude: dbCmd.gte(range.minLat).and(dbCmd.lte(range.maxLat)),
    longitude: dbCmd.gte(range.minLon).and(dbCmd.lte(range.maxLon)),
    role: "user",
  };

  // 水平筛选
  if (level) {
    where.level = level;
  }

  const result = await db
    .collection("users")
    .where(where)
    .orderBy("locationUpdatedAt", "desc")
    .limit(limitNum)
    .get();

  // 计算精确距离并过滤
  const friends = result.data
    .filter((u) => u._openid !== myOpenid) // 排除自己
    .map((user) => {
      const distance = calcDistance(latitude, longitude, user.latitude, user.longitude);
      return {
        openid: user._openid,
        id: user._id,
        nickname: user.nickname || "羽球新人",
        region: user.region || "",
        availability: user.availability || "",
        level: user.level || "待测评",
        tags: user.tags || [],
        distance,
        distanceText:
          distance < 1
            ? Math.round(distance * 1000) + "m"
            : distance.toFixed(1) + "km",
      };
    })
    .filter((u) => u.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);

  return {
    ok: true,
    data: friends,
    total: friends.length,
    radius: radiusKm,
  };
};
