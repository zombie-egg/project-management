<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="page-title">我的汇总</h2>
        <p class="page-sub">接单数量、项目明细、进度、累计技术费用和待支付金额</p>
      </div>
      <el-button :icon="Refresh" circle @click="load" />
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
      <div class="apple-card !p-4"><div class="text-sm text-apple-gray">累计接单</div><div class="text-2xl font-semibold text-apple-blue mt-1">{{ summary.totalOrders }}</div></div>
      <div class="apple-card !p-4"><div class="text-sm text-apple-gray">已完工</div><div class="text-2xl font-semibold mt-1" style="color:#34c759">{{ summary.completed }}</div></div>
      <div class="apple-card !p-4"><div class="text-sm text-apple-gray">付款申请中</div><div class="text-2xl font-semibold mt-1" style="color:#ff9500">{{ summary.paymentRequested }}</div></div>
      <div class="apple-card !p-4"><div class="text-sm text-apple-gray">完工率</div><div class="text-2xl font-semibold mt-1">{{ summary.completeRate }}%</div></div>
      <div class="apple-card !p-4"><div class="text-sm text-apple-gray">累计项目营收</div><div class="text-xl font-semibold text-apple-blue mt-1">{{ money(summary.totalIncome) }}</div></div>
      <div class="apple-card !p-4"><div class="text-sm text-apple-gray">累计技术费用</div><div class="text-xl font-semibold mt-1" style="color:#34c759">{{ money(summary.totalTechFee) }}</div></div>
      <div class="apple-card !p-4"><div class="text-sm text-apple-gray">待支付技术费用</div><div class="text-xl font-semibold mt-1" style="color:#ff375f">{{ money(summary.unpaidTechFee) }}</div></div>
      <div class="apple-card !p-4"><div class="text-sm text-apple-gray">进行中项目</div><div class="text-2xl font-semibold mt-1" style="color:#ff9500">{{ summary.inProgress }}</div></div>
    </div>

    <div class="apple-card">
      <div class="font-medium mb-3">项目明细</div>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="name" label="项目名称" min-width="180">
          <template #default="{ row }"><el-link type="primary" @click="$router.push(`/projects/${row.id}`)">{{ row.name }}</el-link></template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" width="110" />
        <el-table-column label="状态" width="130">
          <template #default="{ row }"><el-tag :type="STATUS_TAG_TYPE[row.status]" size="small">{{ row.status_label }}</el-tag></template>
        </el-table-column>
        <el-table-column label="进度" min-width="160">
          <template #default="{ row }"><el-progress :percentage="row.progress" :stroke-width="6" /></template>
        </el-table-column>
        <el-table-column label="项目营收" width="130"><template #default="{ row }">{{ money(row.income) }}</template></el-table-column>
        <el-table-column label="技术费用" width="130"><template #default="{ row }">{{ money(row.tech_fee) }}</template></el-table-column>
        <el-table-column label="已支付" width="130"><template #default="{ row }">{{ money(row.tech_fee_paid) }}</template></el-table-column>
        <el-table-column label="待支付" width="130"><template #default="{ row }"><span :style="{ color: row.unpaid_tech_fee ? '#ff375f' : '#34c759' }">{{ money(row.unpaid_tech_fee) }}</span></template></el-table-column>
        <el-table-column label="申请" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.payment_requested && !row.settled" type="warning" size="small">待结算</el-tag>
            <el-tag v-else-if="row.settled" type="success" size="small">已结算</el-tag>
            <span v-else class="text-apple-gray">—</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && !list.length" description="暂无项目" />
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue';
import { Refresh } from '@element-plus/icons-vue';
import { api } from '@/api';
import { money, STATUS_TAG_TYPE } from '@/utils/constants';

const loading = ref(false);
const list = ref([]);
const summary = reactive({
  totalOrders: 0, completed: 0, inProgress: 0, paymentRequested: 0,
  totalIncome: 0, totalTechFee: 0, unpaidTechFee: 0, completeRate: 0
});

async function load() {
  loading.value = true;
  try {
    const data = await api.techSummary();
    Object.assign(summary, data.summary);
    list.value = data.list || [];
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>
