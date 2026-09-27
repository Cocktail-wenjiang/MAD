Page({
  data: {
    matches: [
      { title: "周六晚双打", place: "学校体育馆", level: "入门至初级", time: "19:00 - 21:00" },
      { title: "周日晨练", place: "大学城羽毛球馆", level: "初级", time: "09:00 - 11:00" },
    ],
  },
  onShow() {
    const { redirectToLogin } = require("../../utils/session");
    redirectToLogin();
  },
});
