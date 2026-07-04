<template>
  <div>
    <div class="mb-6"><h2 class="page-title">回款逾期统计</h2><p class="page-sub">已完工但未结算尾款的项目（含旧项目）· 按逾期天数排序</p></div>

    <!-- 服务器到期预警 -->
    <div v-if="warning.length" class="apple-card mb-4">
      <div class="font-medium mb-3 flex items-center gap-2"><el-icon color="#ff375f"><Warning /></el-icon> 服务器到期预警</div>
      <el-table :data="warning" size="small">
        <el-table-column prop="name" label="项目" min-width="160" />
        <el-table-column prop="customer_name" label="客户" width="100" />
        <el-table-column prop="server_expire_date" label="到期日" width="120" />
        <el-table-column prop="server_owner" label="归属" width="80" />
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag :type="row.expired?'danger':'warning'" size="small">{{ row.expired ? `已过期${-row.remainDays}天` : `剩${row.remainDays}天` }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="apple-card">
      <div class="font-medium mb-3">回款逾期列表</div>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="name" label="项目名称" min-width="180">
          <template #default="{ row }"><el-link type="primary" @click="$router.push(`/projects/${row.id}`)">{{ row.name }}</el-link></template>
        </el-table-column>
        <el-table-column label="类型" width="100"><template #default="{ row }"><el-tag size="small" :type="row.project_type==='maintenance'?'info':'primary'">{{ row.project_type==='maintenance'?'旧维护':'常规' }}</el-tag></template></el-table-column>
        <el-table-column prop="customer_name" label="客户" width="100" />
        <el-table-column prop="customer_phone" label="联系方式" width="140" />
        <el-table-column label="总酬劳" width="120"><template #default="{ row }">{{ money(row.total_reward) }}</template></el-table-column>
        <el-table-column label="已回款" width="120"><template #default="{ row }">{{ money(row.received) }}</template></el-table-column>
        <el-table-column label="未回款" width="120"><template #default="{ row }"><span style="color:#ff375f">{{ money(row.unpaid) }}</span></template></el-table-column>
        <el-table-column label="逾期天数" width="110">
          <template #default="{ row }"><el-tag :type="row.overdueDays>30?'danger':'warning'" size="small">{{ row.overdueDays }} 天</el-tag></template>
        </el-table-column>
        <el-table-column prop="actual_finish_time" label="完工时间" width="130" />
      </el-table>
      <el-empty v-if="!loading && !list.length" description="暂无逾期回款项目" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Warning } from '@element-plus/icons-vue';
import { api } from '@/api';
import { money } from '@/utils/constants';

const loading = ref(false);
const list = ref([]);
const warning = ref([]);

onMounted(async () => {
  loading.value = true;
  try {
    [list.value, warning.value] = await Promise.all([api.overdue(), api.expireWarning(30)]);
  } finally { loading.value = false; }
});
</script>
