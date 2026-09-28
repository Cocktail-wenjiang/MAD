const db = uniCloud.database();
const dbCmd = db.command;

// Haversine 公式计算两点间距离（单位：公里）
function calcDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // 地球半径，单位 km
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

// 根据距离反推经纬度大致范围（粗筛用）
function getLatLonRange(latitude, longitude, radiusKm) {
  const latDelta = radiusKm / 111; // 1度纬度约111km
  const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));
  return {
    minLat: latitude - latDelta,
    maxLat: latitude + latDelta,
    minLon: longitude - lonDelta,
    maxLon: longitude + lonDelta,
  };
}

function formatTime(timestamp) {
  const d = new Date(timestamp);
  const pad = (n) => (n < 10 ? "0" + n : "" + n);
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${month}-${day} ${hours}:${minutes}`;
}

exports.main = async (event, context) => {
  const { latitude, longitude, radius = 10, limit = 50, levels = null } = event;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return { ok: false, code: "invalid-location", msg: "位置参数错误" };
  }

  const radiusKm = Math.min(Math.max(Number(radius) || 10, 1), 100); // 1~100km
  const limitNum = Math.min(Math.max(Number(limit) || 50, 1), 100);

  const range = getLatLonRange(latitude, longitude, radiusKm);

  // 构建查询条件
  const where = {
    latitude: dbCmd.gte(range.minLat).and(dbCmd.lte(range.maxLat)),
    longitude: dbCmd.gte(range.minLon).and(dbCmd.lte(range.maxLon)),
    status: "active",
    endTime: dbCmd.gt(Date.now()),
  };

  // 水平筛选
  if (levels && Array.isArray(levels) && levels.length > 0) {
    where.level = dbCmd.in(levels);
  }

  // 先按矩形范围粗筛 + 状态为 active + 活动未结束
  const result = await db
    .collection("matches")
    .where(where)
    .orderBy("startTime", "asc")
    .limit(limitNum)
    .get();

  // 精算距离并过滤
  const matchesWithDistance = result.data
    .map((item) => {
      const distance = calcDistance(latitude, longitude, item.latitude, item.longitude);
      return {
        ...item,
        distance,
        distanceText:
          distance < 1
            ? Math.round(distance * 1000) + "m"
            : distance.toFixed(1) + "km",
        timeText: formatTime(item.startTime),
        joinedCount: (item.joinedPlayers || []).length,
      };
    })
    .filter((item) => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);

  return {
    ok: true,
    data: matchesWithDistance,
    total: matchesWithDistance.length,
    radius: radiusKm,
  };
};
