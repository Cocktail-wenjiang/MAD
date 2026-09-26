# 羽友 Uni-app 版本

这是羽友的 uni-app Vue 3 版本，可编译为微信小程序、H5 和 App。原生微信小程序版本仍保留在上级目录的 `BadmintonFriendApp`。

## 编译到微信小程序

1. 用 HBuilderX 打开本目录。
2. 修改 `manifest.json` 中 `mp-weixin.appid` 为你的小程序 AppID。
3. 选择“运行 → 运行到小程序模拟器 → 微信开发者工具”，或“发行 → 小程序-微信”。
4. 若选择发行，导入生成的 `unpackage/dist/build/mp-weixin` 到微信开发者工具。

## uniCloud

在 HBuilderX 中绑定腾讯云云空间（TCB）或兼容的 uniCloud 云空间，把 `utils/cloud.js` 的 `YOUR_UNICLOUD_ENV_ID` 改成 spaceId，然后部署 `uniCloud/cloudfunctions` 下的 6 个云函数。集合为 `users`、`banners`、`assessments`，前端未配置云空间时会自动使用本地演示数据。

初始演示管理员：`admin / admin123`。真实云端管理员需要在 `users` 集合把对应记录的 `role` 设为 `admin`。
