<template>
  <div :class="theme === 'dark' ? 'screen-dark -m-6 p-6 min-h-full' : ''">
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="page-title" :class="theme==='dark' ? 'text-white' : ''">数据可视化大屏</h2>
        <p class="page-sub">全量统计 · 常规项目 + 旧完结维护项目 100% 并入</p>
      </div>
      <div class="flex flex-wrap justify-end gap-3">
        <el-select v-model="filters.period" class="!w-24" @change="onPeriodChange">
          <el-option label="按月" value="month" />
          <el-option label="按年" value="year" />
        </el-select>
        <el-date-picker
          v-if="filters.period === 'month'"
          v-model="filters.month"
          type="month"
          value-format="YYYY-MM"
          placeholder="选择月份"
          class="!w-36"
          clearable
          @change="load"
        />
        <el-date-picker
          v-else
          v-model="filters.year"
          type="year"
          value-format="YYYY"
          placeholder="选择年份"
          class="!w-32"
          clearable
          @change="load"
        />
        <el-switch v-model="isDark" active-text="暗色大屏" inline-prompt @change="toggleTheme" />
        <el-button :icon="Refresh" circle @click="load" />
      </div>
    </div>

    <!-- 核心指标卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div v-for="c in cards" :key="c.label" class="apple-card !p-5" :class="c.click ? 'cursor-pointer hover:!shadow-cardHover' : ''" @click="goCard(c)">
        <div class="text-sm text-apple-gray">{{ c.label }}</div>
        <div class="text-2xl font-semibold mt-2" :style="{ color: c.color }">{{ c.value }}</div>
      </div>
    </div>

    <!-- 项目类型看板 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div class="apple-card">
        <div class="font-medium mb-3">常规开发项目</div>
        <div class="flex justify-between items-end">
          <div><span class="text-3xl font-semibold text-apple-blue">{{ board.normal.count }}</span> <span class="text-apple-gray">个</span></div>
          <div class="text-apple-gray">收入 {{ money(board.normal.amount) }}</div>
        </div>
      </div>
      <div class="apple-card">
        <div class="font-medium mb-3">纯维护 / 旧完结项目</div>
        <div class="flex justify-between items-end">
          <div><span class="text-3xl font-semibold" style="color:#34c759">{{ board.maintenance.count }}</span> <span class="text-apple-gray">个</span></div>
          <div class="text-apple-gray">收入 {{ money(board.maintenance.amount) }}</div>
        </div>
      </div>
    </div>

    <!-- 图表区 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="apple-card"><div ref="chartStatus" class="h-72"></div></div>
      <div class="apple-card"><div ref="chartType" class="h-72"></div></div>
      <div class="apple-card"><div ref="chartRevenue" class="h-72"></div></div>
      <div class="apple-card"><div ref="chartProfit" class="h-72"></div></div>
      <div class="apple-card"><div ref="chartTech" class="h-72"></div></div>
      <div class="apple-card"><div ref="chartFinish" class="h-72"></div></div>
      <div class="apple-card"><div ref="chartFund" class="h-72"></div></div>
      <div class="apple-card">
        <div class="grid grid-cols-2 gap-2 h-72">
          <div ref="chartServerPush" class="h-full"></div>
          <div ref="chartServerOwner" class="h-full"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import * as echarts from 'echarts';
import { Refresh } from '@element-plus/icons-vue';
import { api } from '@/api';
import { money } from '@/utils/constants';

const isDark = ref(false);
const theme = ref('light');
const router = useRouter();
const cards = ref([]);
const board = reactive({ normal: { count: 0, amount: 0 }, maintenance: { count: 0, amount: 0 } });
const filters = reactive({ period: 'month', year: '', month: '' });

const chartStatus = ref(), chartType = ref(), chartRevenue = ref(), chartProfit = ref();
const chartTech = ref(), chartFinish = ref(), chartFund = ref(), chartServerPush = ref(), chartServerOwner = ref();
let instances = [];
let refreshTimer = null;

const PALETTE = ['#0071e3', '#34c759', '#ff9500', '#ff375f', '#5e5ce6', '#64d2ff', '#bf5af2', '#ffd60a'];

function makeChart(el, option) {
  if (!el) return;
  const inst = echarts.init(el, null, { renderer: 'canvas' });
  const base = {
    color: PALETTE,
    textStyle: { color: theme.value === 'dark' ? '#f5f5f7' : '#1d1d1f', fontFamily: 'inherit' },
    tooltip: { trigger: 'item' }
  };
  inst.setOption({ ...base, ...option });
  instances.push(inst);
}

function pie(title, data, ring = false) {
  return {
    title: { text: title, left: 'center', textStyle: { fontSize: 14, color: theme.value === 'dark' ? '#f5f5f7' : '#1d1d1f' } },
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, textStyle: { color: theme.value === 'dark' ? '#c7c7cc' : '#86868b' } },
    series: [{
      type: 'pie',
      radius: ring ? ['40%', '65%'] : '60%',
      center: ['50%', '48%'],
      data,
      itemStyle: { borderRadius: 6, borderColor: theme.value === 'dark' ? '#16161c' : '#fff', borderWidth: 2 },
      label: { color: theme.value === 'dark' ? '#c7c7cc' : '#86868b' }
    }]
  };
}

function bar(title, series, color = '#0071e3', horizontal = false) {
  const cat = { type: 'category', data: series.map((s) => s.name), axisLine: { lineStyle: { color: '#d2d2d7' } }, axisLabel: { color: theme.value === 'dark' ? '#c7c7cc' : '#86868b' } };
  const val = { type: 'value', axisLabel: { color: theme.value === 'dark' ? '#c7c7cc' : '#86868b' }, splitLine: { lineStyle: { color: theme.value === 'dark' ? '#2c2c2e' : '#f0f0f0' } } };
  return {
    title: { text: title, left: 'center', textStyle: { fontSize: 14, color: theme.value === 'dark' ? '#f5f5f7' : '#1d1d1f' } },
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 50, bottom: 30 },
    xAxis: horizontal ? val : cat,
    yAxis: horizontal ? cat : val,
    series: [{ type: 'bar', data: series.map((s) => s.value), itemStyle: { color, borderRadius: 4 }, barMaxWidth: 40 }]
  };
}

function line(title, series, color = '#34c759') {
  return {
    title: { text: title, left: 'center', textStyle: { fontSize: 14, color: theme.value === 'dark' ? '#f5f5f7' : '#1d1d1f' } },
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 50, bottom: 30 },
    xAxis: { type: 'category', data: series.map((s) => s.name), axisLabel: { color: theme.value === 'dark' ? '#c7c7cc' : '#86868b' } },
    yAxis: { type: 'value', axisLabel: { color: theme.value === 'dark' ? '#c7c7cc' : '#86868b' }, splitLine: { lineStyle: { color: theme.value === 'dark' ? '#2c2c2e' : '#f0f0f0' } } },
    series: [{ type: 'line', smooth: true, data: series.map((s) => s.value), itemStyle: { color }, areaStyle: { opacity: 0.1, color } }]
  };
}

function disposeAll() {
  instances.forEach((i) => i.dispose());
  instances = [];
}

async function load() {
  const d = await api.dashboard(filters);
  cards.value = [
    { label: '总项目数', value: d.cards.totalProjects, color: '#0071e3', click: {} },
    { label: '进行中', value: d.cards.inProgress, color: '#ff9500', click: { status_group: 'in_progress' } },
    { label: '已完工/旧完结', value: d.cards.completed, color: '#34c759', click: { status: 'completed' } },
    { label: '待接单', value: d.cards.pending, color: '#86868b', click: { status: 'pending' } },
    { label: '总营收', value: money(d.cards.totalIncome), color: '#0071e3' },
    { label: '总支出', value: money(d.cards.totalCost), color: '#ff375f' },
    { label: '总净利润', value: money(d.cards.totalProfit), color: '#34c759' },
    { label: '待结算金额', value: money(d.cards.pendingSettle), color: '#ff9500' }
  ];
  Object.assign(board, d.typeBoard);

  await nextTick();
  disposeAll();
  makeChart(chartStatus.value, pie('项目状态占比', d.statusDist));
  makeChart(chartType.value, pie('新旧项目占比', d.typeDist, true));
  makeChart(chartRevenue.value, bar('月度营收', d.monthRevenue, '#0071e3'));
  makeChart(chartProfit.value, bar('月度利润', d.monthProfit, '#34c759'));
  makeChart(chartTech.value, bar('技术员承接项目数', d.techStat, '#5e5ce6', true));
  makeChart(chartFinish.value, line('项目完工趋势（含历史旧项目）', d.finishTrend, '#ff9500'));
  makeChart(chartFund.value, pie('资金收支占比', d.fundRing, true));
  makeChart(chartServerPush.value, pie('服务器首推占比', d.serverPush));
  makeChart(chartServerOwner.value, pie('服务器归属分布', d.serverOwner));
}

function refreshWhenVisible() {
  if (!document.hidden) load();
}

function toggleTheme(v) {
  theme.value = v ? 'dark' : 'light';
  document.body.classList.toggle('dashboard-dark-shell', !!v);
  load();
}

function onPeriodChange() {
  if (filters.period === 'year') filters.month = '';
  else filters.year = '';
  load();
}

function goCard(card) {
  if (!card.click) return;
  router.push({ path: '/projects', query: card.click });
}

const onResize = () => instances.forEach((i) => i.resize());

onMounted(async () => {
  try {
    const s = await api.getSettings();
    if (s.dashboard_theme === 'dark') { isDark.value = true; theme.value = 'dark'; }
  } catch (e) { /* ignore */ }
  document.body.classList.toggle('dashboard-dark-shell', isDark.value);
  await load();
  window.addEventListener('resize', onResize);
  window.addEventListener('focus', refreshWhenVisible);
  document.addEventListener('visibilitychange', refreshWhenVisible);
  refreshTimer = window.setInterval(refreshWhenVisible, 15000);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize);
  window.removeEventListener('focus', refreshWhenVisible);
  document.removeEventListener('visibilitychange', refreshWhenVisible);
  if (refreshTimer) window.clearInterval(refreshTimer);
  document.body.classList.remove('dashboard-dark-shell');
  disposeAll();
});
</script>
