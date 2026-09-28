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

## AI 球员火柴人标注

`backend` 目录提供离线 MP4 姿态分析：上传视频后保留原背景，在球员位置叠加
SoloShuttlePose 兼容的 17 点火柴人，并返回标注视频、逐帧 JSONL 和摘要。第一版
只标注球员，不追踪或显示羽毛球，也不擦除真人。后端安装、权重路径、CUDA/CPU
选择和 API 示例见 [`backend/README.md`](backend/README.md) 与
[`backend/docs/pose-api.md`](backend/docs/pose-api.md)。

该功能复用 [SoloShuttlePose](https://github.com/sunwuzhou03/SoloShuttlePose)，
保留 MIT 许可和版权说明；使用 ShuttleSet/ShuttleSet22 训练或评估时须引用对应
论文并遵守数据集条款。原始视频、权重和用户上传文件不纳入仓库。
