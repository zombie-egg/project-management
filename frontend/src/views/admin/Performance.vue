<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="page-title">技术员业绩统计</h2>
        <p class="page-sub">仅统计常规分配项目 · 营收 / 技术费用 / 完工率</p>
      </div>
      <el-button :icon="Refresh" circle @click="load" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div class="apple-card"><div ref="chartRevenue" class="h-80"></div></div>
      <div class="apple-card"><div ref="chartRate" class="h-80"></div></div>
    </div>

    <div class="apple-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="name" label="技术员" width="120" />
        <el-table-column prop="projectCount" label="承接项目数" width="120" />
        <el-table-column prop="completedCount" label="已完工数" width="120" />
        <el-table-column label="完工率" width="140">
          <template #default="{ row }"><el-progress :percentage="row.completeRate" :stroke-width="10" /></template>
        </el-table-column>
        <el-table-column label="总营收"><template #default="{ row }">{{ money(row.totalRevenue) }}</template></el-table-column>
        <el-table-column label="总技术费用"><template #default="{ row }">{{ money(row.totalTechFee) }}</template></el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as echarts from 'echarts';
import { Refresh } from '@element-plus/icons-vue';
import { api } from '@/api';
import { money } from '@/utils/constants';

const loading = ref(false);
const list = ref([]);
const chartRevenue = ref();
const chartRate = ref();
let instances = [];
let refreshTimer = null;

onMounted(async () => {
  await load();
  window.addEventListener('resize', resizeCharts);
  window.addEventListener('focus', refreshWhenVisible);
  document.addEventListener('visibilitychange', refreshWhenVisible);
  refreshTimer = window.setInterval(refreshWhenVisible, 15000);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts);
  window.removeEventListener('focus', refreshWhenVisible);
  document.removeEventListener('visibilitychange', refreshWhenVisible);
  if (refreshTimer) window.clearInterval(refreshTimer);
  disposeCharts();
});

async function load() {
  loading.value = true;
  try {
    list.value = await api.performance();
    await nextTick();
    renderCharts();
  } finally { loading.value = false; }
}

function refreshWhenVisible() {
  if (!document.hidden) load();
}

function resizeCharts() {
  instances.forEach((i) => i.resize());
}

function disposeCharts() {
  instances.forEach((i) => i.dispose());
  instances = [];
}

function renderCharts() {
  disposeCharts();
  const names = list.value.map((x) => x.name);
  const i1 = echarts.init(chartRevenue.value);
  i1.setOption({
    color: ['#0071e3'],
    title: { text: '各技术员总营收', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 60, right: 20, top: 50, bottom: 30 },
    xAxis: { type: 'category', data: names },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: list.value.map((x) => x.totalRevenue), itemStyle: { color: '#0071e3', borderRadius: 4 }, barMaxWidth: 40 }]
  });
  const i2 = echarts.init(chartRate.value);
  i2.setOption({
    color: ['#34c759'],
    title: { text: '各技术员完工率(%)', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 50, bottom: 30 },
    xAxis: { type: 'category', data: names },
    yAxis: { type: 'value', max: 100 },
    series: [{ type: 'bar', data: list.value.map((x) => x.completeRate), itemStyle: { color: '#34c759', borderRadius: 4 }, barMaxWidth: 40 }]
  });
  instances = [i1, i2];
}
</script>
