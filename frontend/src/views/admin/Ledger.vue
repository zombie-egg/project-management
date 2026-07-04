<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div><h2 class="page-title">资金台账</h2><p class="page-sub">所有收支流水 · 新旧项目全部入账</p></div>
      <div class="flex gap-3">
        <el-button type="primary" :icon="Plus" @click="openAdd">新增流水</el-button>
        <el-button :icon="Download" @click="onExport">导出Excel</el-button>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
      <div class="apple-card !p-4"><div class="text-sm text-apple-gray">收入合计</div><div class="text-xl font-semibold text-apple-blue mt-1">{{ money(summary.total_in) }}</div></div>
      <div class="apple-card !p-4"><div class="text-sm text-apple-gray">支出合计</div><div class="text-xl font-semibold" style="color:#ff375f">{{ money(summary.total_out) }}</div></div>
      <div class="apple-card !p-4"><div class="text-sm text-apple-gray">结余</div><div class="text-xl font-semibold" style="color:#34c759">{{ money(summary.total_in - summary.total_out) }}</div></div>
    </div>

    <div class="apple-card mb-4">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <el-input v-model="query.keyword" placeholder="搜索项目/备注" clearable :prefix-icon="Search" @keyup.enter="reload" />
        <el-select v-model="query.type" placeholder="款项类型" clearable><el-option v-for="(v,k) in LEDGER_TYPE_LABEL" :key="k" :label="v" :value="k" /></el-select>
        <el-select v-model="query.direction" placeholder="收支方向" clearable><el-option label="收入" value="in" /><el-option label="支出" value="out" /></el-select>
        <el-date-picker v-model="range" type="daterange" range-separator="~" start-placeholder="起" end-placeholder="止" value-format="YYYY-MM-DD" />
        <el-date-picker v-model="query.year" type="year" value-format="YYYY" placeholder="按年筛选" clearable />
        <el-date-picker v-model="query.month" type="month" value-format="YYYY-MM" placeholder="按月筛选" clearable />
        <el-select v-model="query.summary_period" placeholder="汇总维度">
          <el-option label="按月汇总" value="month" />
          <el-option label="按年汇总" value="year" />
        </el-select>
        <div class="flex gap-2"><el-button type="primary" @click="reload">查询</el-button><el-button @click="reset">重置</el-button></div>
      </div>
    </div>

    <div v-if="periodSummary.length" class="apple-card mb-4">
      <div class="font-medium mb-3">年/月筛选汇总</div>
      <el-table :data="periodSummary" size="small">
        <el-table-column prop="period" label="周期" width="120" />
        <el-table-column label="收入"><template #default="{ row }">{{ money(row.total_in) }}</template></el-table-column>
        <el-table-column label="支出"><template #default="{ row }">{{ money(row.total_out) }}</template></el-table-column>
        <el-table-column label="结余"><template #default="{ row }">{{ money(row.balance) }}</template></el-table-column>
      </el-table>
    </div>

    <div class="apple-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="project_name" label="项目" min-width="160" />
        <el-table-column label="类型" width="100"><template #default="{ row }">{{ LEDGER_TYPE_LABEL[row.type] || row.type }}</template></el-table-column>
        <el-table-column label="方向" width="80"><template #default="{ row }"><el-tag size="small" :type="row.direction==='in'?'success':'danger'">{{ row.direction==='in'?'收入':'支出' }}</el-tag></template></el-table-column>
        <el-table-column label="金额" width="130"><template #default="{ row }">{{ money(row.amount) }}</template></el-table-column>
        <el-table-column prop="received_at" label="收付款时间" width="130" />
        <el-table-column prop="operator_name" label="操作人" width="100" />
        <el-table-column prop="remark" label="备注" min-width="140" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }"><el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <div class="flex justify-end mt-4">
        <el-pagination background layout="total, prev, pager, next" :total="total" :current-page="query.page" :page-size="query.pageSize" @current-change="(p)=>{query.page=p; load()}" />
      </div>
    </div>

    <el-dialog v-model="dialog" title="新增流水" width="460px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="项目" required>
          <el-select v-model="form.project_id" filterable placeholder="选择项目" class="w-full">
            <el-option v-for="p in projects" :key="p.id" :label="p.name" :value="p.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="款项类型" required><el-select v-model="form.type" class="w-full"><el-option v-for="(v,k) in LEDGER_TYPE_LABEL" :key="k" :label="v" :value="k" /></el-select></el-form-item>
        <el-form-item label="方向"><el-radio-group v-model="form.direction"><el-radio value="in">收入</el-radio><el-radio value="out">支出</el-radio></el-radio-group></el-form-item>
        <el-form-item label="金额" required><el-input-number v-model="form.amount" :min="0" :precision="2" class="w-full" controls-position="right" /></el-form-item>
        <el-form-item label="收付款时间"><el-date-picker v-model="form.received_at" type="date" value-format="YYYY-MM-DD" class="w-full" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" @click="onSubmit">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Download, Search } from '@element-plus/icons-vue';
import { api } from '@/api';
import { LEDGER_TYPE_LABEL, money } from '@/utils/constants';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const summary = reactive({ total_in: 0, total_out: 0 });
const periodSummary = ref([]);
const projects = ref([]);
const range = ref([]);
const query = reactive({ keyword: '', type: '', direction: '', start_date: '', end_date: '', year: '', month: '', summary_period: 'month', page: 1, pageSize: 10 });

watch(range, (v) => { query.start_date = v?.[0] || ''; query.end_date = v?.[1] || ''; });

async function load() {
  loading.value = true;
  try {
    const data = await api.listLedger(query);
    list.value = data.list; total.value = data.total;
    Object.assign(summary, data.summary);
    periodSummary.value = data.periodSummary || [];
  } finally { loading.value = false; }
}
function reload() { query.page = 1; load(); }
function reset() { Object.assign(query, { keyword: '', type: '', direction: '', start_date: '', end_date: '', year: '', month: '', summary_period: 'month', page: 1 }); range.value = []; load(); }

const dialog = ref(false);
const form = reactive({ project_id: null, type: 'first', direction: 'in', amount: 0, received_at: null, remark: '' });
function openAdd() { Object.assign(form, { project_id: null, type: 'first', direction: 'in', amount: 0, received_at: null, remark: '' }); dialog.value = true; }
async function onSubmit() {
  if (!form.project_id || !form.type) return ElMessage.warning('请填写项目和类型');
  await api.addLedger(form);
  ElMessage.success('新增成功');
  dialog.value = false; load();
}
async function onDelete(row) {
  await ElMessageBox.confirm('确认删除该流水？', '提示', { type: 'warning' });
  await api.deleteLedger(row.id); ElMessage.success('已删除'); load();
}
async function onExport() { await api.exportLedger(query); ElMessage.success('导出中'); }

onMounted(async () => { projects.value = await api.projectOptions(); load(); });
</script>
