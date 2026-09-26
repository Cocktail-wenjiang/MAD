<template>
  <view class="page">
    <AppTopbar title="AI 训练台" action="测评记录" @action="openTrend" />
    <view class="hero">
      <view class="hero-kicker"><text class="dot" />今天的训练方向</view>
      <text class="hero-title">{{ greeting }}，先把回中做稳。</text>
      <text class="hero-copy">根据最近一次测评，AI 为你安排了一个 12 分钟的小练习。</text>
      <view class="hero-meta"><text>训练强度 {{ intensity }}</text><text>预计 12 分钟</text></view>
    </view>

    <view class="section-head"><text>本次建议</text><text class="muted">{{ reportLabel }}</text></view>
    <view class="recommendation">
      <view class="recommendation-icon">↺</view>
      <view class="recommendation-copy"><text class="recommendation-title">{{ recommendation.title }}</text><text class="recommendation-text">{{ recommendation.text }}</text></view>
    </view>

    <view class="section-head"><text>训练清单</text><text class="muted">{{ completed }}/{{ drills.length }} 已完成</text></view>
    <view class="drills">
      <view v-for="(drill, index) in drills" :key="drill.title" class="drill" :class="{done: drill.done}" @tap="toggleDrill(index)">
        <view class="check">{{ drill.done ? '✓' : index + 1 }}</view>
        <view class="drill-copy"><text class="drill-title">{{ drill.title }}</text><text class="drill-detail">{{ drill.detail }}</text></view>
        <text class="drill-time">{{ drill.time }}</text>
      </view>
    </view>

    <view class="quick-actions">
      <button class="primary" @tap="openAssessment">重新测评</button>
      <button class="secondary" @tap="askCoach">问 AI 教练</button>
    </view>
    <text class="disclaimer">AI 建议用于训练参考，会随新测评持续调整。</text>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import AppTopbar from '../../components/AppTopbar.vue'
import { requireLogin } from '../../utils/auth'
import { loadLastReport, loadProfile } from '../../utils/storage'
import { decorateReport } from '../../utils/analysis'

const profile = ref(loadProfile({ nickname: '羽球新人' }))
const report = ref(null)
const drills = ref([
  { title: '无球启动与回中', detail: '保持重心在前脚掌，连续完成 3 组', time: '4 分钟', done: false },
  { title: '高远球击球点', detail: '在最高点击球，注意架拍高度', time: '5 分钟', done: false },
  { title: '轻松拉伸放松', detail: '肩、髋、踝各保持 30 秒', time: '3 分钟', done: false }
])

const recommendation = computed(() => {
  const scores = report.value?.scores || []
  const weakest = scores.slice().sort((a, b) => Number(a.value) - Number(b.value))[0]
  if (!weakest) return { title: '先完成一次视频测评', text: 'AI 会根据你的动作表现，给出更贴合当前阶段的训练顺序。' }
  return { title: `优先练习：${weakest.name}`, text: weakest.issue || '从最低分项开始，短时间重复练习更容易形成稳定动作。' }
})
const completed = computed(() => drills.value.filter(item => item.done).length)
const intensity = computed(() => completed.value > 1 ? '中等' : '轻量')
const greeting = computed(() => (profile.value.nickname || '球友').replace(/同学$/, ''))
const reportLabel = computed(() => report.value ? `最近得分 ${report.value.scoreAverage}` : '等待首次测评')

onShow(() => {
  if (!requireLogin()) return
  profile.value = loadProfile(profile.value)
  const latest = loadLastReport()
  report.value = latest ? decorateReport(latest) : null
})

function toggleDrill(index) { drills.value[index].done = !drills.value[index].done }
function openAssessment() { uni.navigateTo({ url: '/pages/assessment/assessment' }) }
function openTrend() { uni.navigateTo({ url: '/pages/role-center/role-center' }) }
function askCoach() {
  uni.showModal({ title: 'AI 教练', content: `建议从“${recommendation.value.title}”开始。先做一组慢动作，再逐步加快，完成后记得重新拍摄复测。`, showCancel: false, confirmText: '知道了' })
}
</script>

<style scoped>
.page{min-height:100vh;padding-bottom:42rpx;background:#f5f7f5}.hero{margin:24rpx;padding:30rpx;border-radius:20rpx;background:#fff}.hero-kicker{display:flex;align-items:center;color:#6b7b72;font-size:23rpx}.dot{width:12rpx;height:12rpx;margin-right:10rpx;border-radius:50%;background:#07c160}.hero-title{display:block;margin-top:18rpx;color:#172019;font-size:38rpx;font-weight:700;line-height:1.35}.hero-copy{display:block;margin-top:12rpx;color:#68766d;font-size:24rpx;line-height:1.6}.hero-meta{display:flex;margin-top:24rpx;color:#07a753;font-size:22rpx}.hero-meta text+text{margin-left:30rpx}
.section-head{display:flex;justify-content:space-between;align-items:center;padding:0 32rpx 16rpx;color:#253229;font-size:28rpx;font-weight:600}.muted{color:#8a978f;font-size:22rpx;font-weight:400}.recommendation{display:flex;margin:0 24rpx 28rpx;padding:24rpx;border-radius:16rpx;background:#eaf7ee}.recommendation-icon{width:58rpx;height:58rpx;margin-right:18rpx;border-radius:16rpx;text-align:center;line-height:58rpx;color:#087840;background:#c9efd6;font-size:34rpx}.recommendation-copy{flex:1}.recommendation-title{display:block;color:#1e3f2b;font-weight:600;font-size:28rpx}.recommendation-text{display:block;margin-top:8rpx;color:#577063;font-size:23rpx;line-height:1.55}
.drills{margin:0 24rpx 28rpx;border-radius:16rpx;background:#fff}.drill{display:flex;align-items:center;padding:23rpx 20rpx;border-bottom:1rpx solid #eef1ee}.drill:last-child{border-bottom:0}.check{width:44rpx;height:44rpx;margin-right:16rpx;border:2rpx solid #b8c6bc;border-radius:50%;box-sizing:border-box;text-align:center;line-height:40rpx;color:#8b9a90;font-size:21rpx}.done .check{border-color:#07c160;color:#fff;background:#07c160}.drill-copy{flex:1}.drill-title{display:block;color:#253229;font-size:26rpx}.drill-detail{display:block;margin-top:7rpx;color:#8a978f;font-size:21rpx}.drill-time{color:#7d8d83;font-size:21rpx}.done .drill-title{text-decoration:line-through;color:#91a097}
.quick-actions{display:flex;padding:0 24rpx}.quick-actions button{flex:1;height:82rpx;line-height:82rpx;border-radius:12rpx;font-size:26rpx}.quick-actions button+button{margin-left:16rpx}.primary{color:#fff;background:#0a9f4c}.secondary{color:#087840;background:#fff;border:1rpx solid #a8d8b8}.disclaimer{display:block;padding:24rpx 32rpx 0;color:#9aa69e;text-align:center;font-size:20rpx}
</style>
