<template>
  <div>
    <div class="mb-6"><h2 class="page-title">操作日志</h2><p class="page-sub">所有账号的新增、编辑、分配、进度流转、付款申请、资金修改全部留痕</p></div>

    <div class="apple-card mb-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <el-input v-model="query.keyword" placeholder="搜索操作人/描述" clearable :prefix-icon="Search" @keyup.enter="reload" />
        <el-date-picker v-model="range" type="daterange" range-separator="~" start-placeholder="起" end-placeholder="止" value-format="YYYY-MM-DD" />
        <div class="flex gap-2"><el-button type="primary" @click="reload">查询</el-button><el-button @click="reset">重置</el-button></div>
      </div>
    </div>

    <div class="apple-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="user_name" label="操作人" width="120" />
        <el-table-column prop="action" label="动作" width="160" />
        <el-table-column prop="detail" label="详情" min-width="280" />
        <el-table-column prop="created_at" label="时间" width="180" />
      </el-table>
      <div class="flex justify-end mt-4">
        <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="(p)=>{query.page=p; load()}" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { api } from '@/api';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const range = ref([]);
const query = reactive({ keyword: '', start_date: '', end_date: '', page: 1, pageSize: 20 });
watch(range, (v) => { query.start_date = v?.[0] || ''; query.end_date = v?.[1] || ''; });

async function load() { loading.value = true; try { const d = await api.listLogs(query); list.value = d.list; total.value = d.total; } finally { loading.value = false; } }
function reload() { query.page = 1; load(); }
function reset() { Object.assign(query, { keyword: '', start_date: '', end_date: '', page: 1 }); range.value = []; load(); }
onMounted(load);
</script>
