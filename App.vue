<script setup>
import { initCloud } from "./utils/cloud";
initCloud();
</script>

<style>
/* ===== 全局重置 ===== */
page {
  background: #f7f7f7;
  color: #2c3e33;
  font-size: 28rpx;
  line-height: 1.5;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif;
  -webkit-font-smoothing: antialiased;
}

view, text, image, scroll-view {
  box-sizing: border-box;
}

button {
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  font-size: 28rpx;
  line-height: inherit;
}
button::after {
  border: 0;
}

image {
  display: block;
}

/* ===== 安全区适配 ===== */
/* 顶部安全区 padding (状态栏 + 导航栏高度额外预留) */
.safe-top {
  padding-top: env(safe-area-inset-top);
}
/* 底部安全区 padding (Home Indicator) */
.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
/* TabBar 页面底部额外留白 */
.tabbar-bottom {
  padding-bottom: calc(100rpx + env(safe-area-inset-bottom));
}
/* 浮动按钮底部安全区 */
.fab-bottom {
  bottom: calc(120rpx + env(safe-area-inset-bottom));
}

/* ===== 通用工具类 ===== */
.flex {
  display: flex;
}
.flex-center {
  display: flex;
  align-items: center;
  justify-content: center;
}
.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.flex-1 {
  flex: 1;
  min-width: 0;
}
.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.text-ellipsis-2 {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* ===== 通用卡片 ===== */
.card {
  background: #fff;
  border-radius: 16rpx;
  margin: 0 24rpx 24rpx;
  padding: 28rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}

/* ===== 通用按钮 ===== */
.btn-primary {
  background: #0b6e4f;
  color: #fff;
  border-radius: 12rpx;
  font-size: 30rpx;
  font-weight: 500;
  padding: 24rpx 0;
  text-align: center;
}
.btn-primary:active {
  opacity: 0.85;
}
.btn-ghost {
  background: #f3f6f4;
  color: #2c3e33;
  border-radius: 12rpx;
  font-size: 30rpx;
  padding: 24rpx 0;
  text-align: center;
}
.btn-ghost:active {
  opacity: 0.85;
}

/* ===== 滚动优化 ===== */
scroll-view {
  -webkit-overflow-scrolling: touch;
}

/* ===== 文字颜色 ===== */
.text-primary { color: #2c3e33; }
.text-secondary { color: #607067; }
.text-tertiary { color: #8a9a90; }
.text-green { color: #0b6e4f; }
.text-danger { color: #e74c3c; }
</style>
