// 高德地图 Web 服务 API 封装
// 文档：https://lbs.amap.com/api/webservice/guide/api/search

const AMAP_KEY = "f9c52790bebe8667b7ea6bf191572979";
const BASE_URL = "https://restapi.amap.com/v3";

// 逆地理编码：经纬度 → 地址信息
async function regeo(latitude, longitude) {
  const url = `${BASE_URL}/geocode/regeo?key=${AMAP_KEY}&location=${longitude},${latitude}&extensions=base`;
  try {
    const res = await uniCloud.httpclient.request(url, {
      method: "GET",
      dataType: "json",
    });
    if (res.data && res.data.status === "1" && res.data.regeocode) {
      const r = res.data.regeocode;
      return {
        address: r.formatted_address,
        province: r.addressComponent?.province || "",
        city: r.addressComponent?.city || r.addressComponent?.province || "",
        district: r.addressComponent?.district || "",
        township: r.addressComponent?.township || "",
      };
    }
    return null;
  } catch (e) {
    console.error("[高德] 逆地理编码失败", e);
    return null;
  }
}

// 周边搜索：搜索附近的地点（支持关键词、类型）
async function nearbySearch(latitude, longitude, keyword = "", radius = 3000, page = 1, offset = 20) {
  let url = `${BASE_URL}/place/around?key=${AMAP_KEY}&location=${longitude},${latitude}&radius=${radius}&page=${page}&offset=${offset}&extensions=base`;
  if (keyword) {
    url += `&keywords=${encodeURIComponent(keyword)}`;
  }
  // 只搜羽毛球馆/体育场馆类
  url += "&types=060100,060000"; // 体育场馆服务、运动场馆

  try {
    const res = await uniCloud.httpclient.request(url, {
      method: "GET",
      dataType: "json",
    });
    if (res.data && res.data.status === "1") {
      const pois = (res.data.pois || []).map((p) => {
        const [lon, lat] = p.location.split(",").map(Number);
        return {
          id: p.id,
          name: p.name,
          address: p.address || p.pname + p.cityname + p.adname,
          province: p.pname,
          city: p.cityname,
          district: p.adname,
          latitude: lat,
          longitude: lon,
          type: p.type,
          tel: p.tel || "",
          distance: Number(p.distance || 0),
          distanceText: p.distance
            ? p.distance > 1000
              ? (p.distance / 1000).toFixed(1) + "km"
              : p.distance + "m"
            : "",
        };
      });
      return {
        total: Number(res.data.count || 0),
        list: pois,
      };
    }
    return { total: 0, list: [] };
  } catch (e) {
    console.error("[高德] 周边搜索失败", e);
    return { total: 0, list: [] };
  }
}

// 关键词搜索（不限位置时用，一般配合 city）
async function keywordSearch(keyword, city = "", page = 1, offset = 20) {
  let url = `${BASE_URL}/place/text?key=${AMAP_KEY}&keywords=${encodeURIComponent(keyword)}&page=${page}&offset=${offset}&extensions=base`;
  if (city) {
    url += `&city=${encodeURIComponent(city)}&citylimit=true`;
  }
  url += "&types=060100,060000";

  try {
    const res = await uniCloud.httpclient.request(url, {
      method: "GET",
      dataType: "json",
    });
    if (res.data && res.data.status === "1") {
      const pois = (res.data.pois || []).map((p) => {
        const [lon, lat] = p.location.split(",").map(Number);
        return {
          id: p.id,
          name: p.name,
          address: p.address || p.pname + p.cityname + p.adname,
          province: p.pname,
          city: p.cityname,
          district: p.adname,
          latitude: lat,
          longitude: lon,
          type: p.type,
          tel: p.tel || "",
        };
      });
      return {
        total: Number(res.data.count || 0),
        list: pois,
      };
    }
    return { total: 0, list: [] };
  } catch (e) {
    console.error("[高德] 关键词搜索失败", e);
    return { total: 0, list: [] };
  }
}

exports.main = async (event, context) => {
  const { action } = event;

  if (AMAP_KEY === "YOUR_AMAP_KEY") {
    return { ok: false, code: "key-not-configured", msg: "高德地图 Key 未配置" };
  }

  switch (action) {
    case "regeo": {
      const { latitude, longitude } = event;
      if (!latitude || !longitude) return { ok: false, code: "missing-params" };
      const result = await regeo(latitude, longitude);
      return { ok: true, data: result };
    }

    case "nearby": {
      const { latitude, longitude, keyword, radius = 3000, page = 1, offset = 20 } = event;
      if (!latitude || !longitude) return { ok: false, code: "missing-params" };
      const result = await nearbySearch(latitude, longitude, keyword, radius, page, offset);
      return { ok: true, ...result };
    }

    case "search": {
      const { keyword, city, page = 1, offset = 20 } = event;
      if (!keyword) return { ok: false, code: "missing-keyword" };
      const result = await keywordSearch(keyword, city, page, offset);
      return { ok: true, ...result };
    }

    default:
      return { ok: false, code: "unknown-action" };
  }
};
