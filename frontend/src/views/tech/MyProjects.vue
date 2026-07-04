<template>
  <div>
    <div class="mb-6"><h2 class="page-title">我的项目</h2><p class="page-sub">仅显示分配给我的常规项目</p></div>

    <div v-loading="loading">
      <div v-if="list.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="row in list" :key="row.id" class="apple-card cursor-pointer" @click="$router.push(`/projects/${row.id}`)">
          <div class="flex items-center justify-between mb-3">
            <span class="font-medium text-apple-black truncate">{{ row.name }}</span>
            <el-tag :type="STATUS_TAG_TYPE[row.status]" size="small">{{ row.status_label }}</el-tag>
          </div>
          <div class="text-sm text-apple-gray space-y-1">
            <div>客户：{{ row.customer_name }}</div>
            <div>工期：{{ row.duration }}</div>
            <div>开始时间：{{ row.start_time || '未开始' }}</div>
          </div>
          <div class="flex gap-1 mt-3">
            <el-tag v-for="t in row.tags" :key="t.id" size="small" :style="{ color: t.color, borderColor: t.color }" effect="plain">{{ t.name }}</el-tag>
          </div>
          <div class="mt-3 pt-3 border-t border-apple-line">
            <el-progress :percentage="progressPct(row.status)" :stroke-width="6" />
          </div>
        </div>
      </div>
      <el-empty v-else description="暂无分配给你的项目" />

      <div v-if="total > query.pageSize" class="flex justify-center mt-6">
        <el-pagination background layout="prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="(p)=>{query.page=p; load()}" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '@/api';
import { STATUS_TAG_TYPE, STATUS_FLOW } from '@/utils/constants';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const query = reactive({ page: 1, pageSize: 12 });

function progressPct(status) {
  const idx = STATUS_FLOW.indexOf(status);
  return Math.round((idx / (STATUS_FLOW.length - 1)) * 100);
}

async function load() {
  loading.value = true;
  try { const d = await api.listProjects(query); list.value = d.list; total.value = d.total; }
  finally { loading.value = false; }
}
onMounted(load);
</script>
