<template>
  <div>
    <div class="mb-6"><h2 class="page-title">旧项目台账专项统计</h2><p class="page-sub">所有纯维护 / 历史完结项目单独汇总</p></div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="apple-card !p-5"><div class="text-sm text-apple-gray">旧项目总数</div><div class="text-2xl font-semibold text-apple-blue mt-2">{{ summary.count }}</div></div>
      <div class="apple-card !p-5"><div class="text-sm text-apple-gray">总收入</div><div class="text-2xl font-semibold mt-2" style="color:#0071e3">{{ money(summary.totalIncome) }}</div></div>
      <div class="apple-card !p-5"><div class="text-sm text-apple-gray">总支出</div><div class="text-2xl font-semibold mt-2" style="color:#ff375f">{{ money(summary.totalCost) }}</div></div>
      <div class="apple-card !p-5"><div class="text-sm text-apple-gray">总利润</div><div class="text-2xl font-semibold mt-2" style="color:#34c759">{{ money(summary.totalProfit) }}</div></div>
    </div>

    <div class="apple-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="name" label="项目名称" min-width="180">
          <template #default="{ row }"><el-link type="primary" @click="$router.push(`/projects/${row.id}`)">{{ row.name }}</el-link></template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" width="100" />
        <el-table-column prop="customer_phone" label="联系方式" width="140" />
        <el-table-column label="收入" width="120"><template #default="{ row }">{{ money(row.income) }}</template></el-table-column>
        <el-table-column label="利润" width="120"><template #default="{ row }"><span style="color:#34c759">{{ money(row.profit) }}</span></template></el-table-column>
        <el-table-column label="维护金额" width="120"><template #default="{ row }">{{ money(row.maintenance_amount) }}</template></el-table-column>
        <el-table-column prop="actual_finish_time" label="实际完工时间" width="140" />
        <el-table-column label="结算" width="90"><template #default="{ row }"><el-tag size="small" :type="row.settled?'success':'warning'" effect="plain">{{ row.settled?'已结算':'未结算' }}</el-tag></template></el-table-column>
        <el-table-column prop="remark" label="备注" min-width="140" />
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { api } from '@/api';
import { money } from '@/utils/constants';

const loading = ref(false);
const list = ref([]);
const summary = reactive({ count: 0, totalIncome: 0, totalCost: 0, totalProfit: 0 });

onMounted(async () => {
  loading.value = true;
  try {
    const data = await api.maintenanceReport();
    list.value = data.list;
    Object.assign(summary, data.summary);
  } finally { loading.value = false; }
});
</script>
