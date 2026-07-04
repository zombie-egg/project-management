<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="page-title">项目管理</h2>
        <p class="page-sub">共 {{ total }} 个项目 · 支持全量筛选、模糊搜索、导出</p>
      </div>
      <div class="flex gap-3">
        <el-button type="primary" :icon="Plus" @click="$router.push('/projects/new')">录入项目</el-button>
        <el-button :icon="Download" @click="onExport">导出Excel</el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="apple-card mb-4">
      <div class="project-filter-grid">
        <el-input v-model="query.keyword" placeholder="搜索项目/群名/客户/电话/描述/技术员/备注" clearable :prefix-icon="Search" @keyup.enter="reload" @clear="reload" />
        <el-select v-model="query.project_type" placeholder="项目类型" clearable @change="reload" @clear="reload">
          <el-option label="常规开发项目" :value="1" /><el-option label="历史维护完结项目" :value="2" />
        </el-select>
        <el-select v-model="query.status" placeholder="项目状态" clearable @change="reload" @clear="reload">
          <el-option v-for="(v,k) in STATUS_LABEL" :key="k" :label="v" :value="k" />
        </el-select>
        <el-select v-model="query.tech_id" placeholder="分配技术员" clearable @change="reload" @clear="reload">
          <el-option v-for="t in techs" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
        <el-select v-model="query.settled" placeholder="结算状态" clearable @change="reload" @clear="reload">
          <el-option label="已结算" :value="1" /><el-option label="未结算" :value="0" />
        </el-select>
        <el-select v-model="query.payment_requested" placeholder="付款申请" clearable @change="reload" @clear="reload">
          <el-option label="待结算申请" :value="1" />
          <el-option label="无付款申请" :value="0" />
        </el-select>
        <el-select v-model="query.server_first_push" placeholder="服务器首推" clearable @change="reload" @clear="reload">
          <el-option label="是" value="是" /><el-option label="否" value="否" />
        </el-select>
        <el-select v-model="query.server_owner" placeholder="服务器归属" clearable @change="reload" @clear="reload">
          <el-option label="个人" value="个人" /><el-option label="公司" value="公司" />
        </el-select>
        <el-select v-model="query.tag_id" placeholder="标签" clearable @change="reload" @clear="reload">
          <el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
        <div class="filter-date-group">
          <div class="filter-date-label">创建时间</div>
          <el-date-picker v-model="createRange" class="filter-date-range" type="daterange" range-separator="~" start-placeholder="创建起" end-placeholder="创建止" value-format="YYYY-MM-DD" @change="reload" />
        </div>
        <div class="filter-date-group">
          <div class="filter-date-label">完工时间</div>
          <el-date-picker v-model="finishRange" class="filter-date-range" type="daterange" range-separator="~" start-placeholder="完工起" end-placeholder="完工止" value-format="YYYY-MM-DD" @change="reload" />
        </div>
        <div class="filter-date-group">
          <div class="filter-date-label">维护费到期</div>
          <el-date-picker v-model="maintenanceExpireRange" class="filter-date-range" type="daterange" range-separator="~" start-placeholder="到期起" end-placeholder="到期止" value-format="YYYY-MM-DD" @change="reload" />
        </div>
        <div class="filter-actions">
          <el-button type="primary" @click="reload">查询</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </div>
      </div>
    </div>

    <!-- 表格 -->
    <div class="apple-card">
      <div v-if="selection.length" class="mb-3">
        <el-button type="danger" :icon="Delete" size="small" @click="onBatchDelete">批量删除（{{ selection.length }}）</el-button>
      </div>
      <el-table :data="list" v-loading="loading" @selection-change="(v)=>selection=v" stripe>
        <el-table-column type="selection" width="45" />
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column label="项目名称" min-width="160">
          <template #default="{ row }">
            <el-link type="primary" @click="$router.push(`/projects/${row.id}`)">{{ row.name }}</el-link>
            <div class="flex gap-1 mt-1">
              <el-tag v-for="t in row.tags" :key="t.id" size="small" :style="{ color: t.color, borderColor: t.color }" effect="plain">{{ t.name }}</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="isHistoryProject(row.project_type) ? 'info' : 'primary'" effect="light" size="small">
              {{ projectTypeShortLabel(row.project_type) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="customer_name" label="客户" width="90" />
        <el-table-column prop="group_name" label="群名" min-width="120" show-overflow-tooltip />
        <el-table-column prop="tech_name" label="技术员" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="STATUS_TAG_TYPE[row.status]" size="small">{{ row.status_label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="收入" width="110"><template #default="{ row }">{{ money(row.income) }}</template></el-table-column>
        <el-table-column label="利润" width="110"><template #default="{ row }"><span style="color:#34c759">{{ money(row.profit) }}</span></template></el-table-column>
        <el-table-column label="结算" width="80">
          <template #default="{ row }"><el-tag :type="row.settled ? 'success' : 'warning'" size="small" effect="plain">{{ row.settled ? '已结算' : '未结算' }}</el-tag></template>
        </el-table-column>
        <el-table-column label="源码" width="80">
          <template #default="{ row }">{{ row.source_uploaded === null || row.source_uploaded === undefined ? '—' : (row.source_uploaded ? '是' : '否') }}</template>
        </el-table-column>
        <el-table-column prop="maintenance_expire_date" label="维护到期" width="120" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="$router.push(`/projects/${row.id}`)">详情</el-button>
            <el-button link type="primary" size="small" @click="$router.push(`/projects/${row.id}/edit`)">编辑</el-button>
            <el-button v-if="!isHistoryProject(row.project_type)" link type="primary" size="small" @click="openAssign(row)">分配</el-button>
            <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="flex justify-end mt-4">
        <el-pagination
          background layout="total, sizes, prev, pager, next"
          :total="total" :current-page="query.page" :page-size="query.pageSize"
          :page-sizes="[10,20,50,100]"
          @current-change="(p)=>{query.page=p; load()}"
          @size-change="(s)=>{query.pageSize=s; query.page=1; load()}"
        />
      </div>
    </div>

    <!-- 分配弹窗 -->
    <el-dialog v-model="assignDialog" title="分配技术员" width="400px">
      <el-select v-model="assignTechId" placeholder="选择技术员" class="w-full">
        <el-option v-for="t in techs" :key="t.id" :label="`${t.name}（${t.username}）`" :value="t.id" />
      </el-select>
      <template #footer>
        <el-button @click="assignDialog=false">取消</el-button>
        <el-button type="primary" @click="confirmAssign">确认分配</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Download, Search, Delete } from '@element-plus/icons-vue';
import { api } from '@/api';
import { STATUS_LABEL, STATUS_TAG_TYPE, money, isHistoryProject, projectTypeShortLabel } from '@/utils/constants';

const loading = ref(false);
const route = useRoute();
const list = ref([]);
const total = ref(0);
const techs = ref([]);
const tags = ref([]);
const selection = ref([]);
const createRange = ref([]);
const finishRange = ref([]);
const maintenanceExpireRange = ref([]);

const query = reactive({
  keyword: '', project_type: '', status: '', tech_id: '', settled: '',
  status_group: '', payment_requested: '', server_first_push: '', server_owner: '', tag_id: '',
  start_date: '', end_date: '', finish_start: '', finish_end: '', maintenance_expire_start: '', maintenance_expire_end: '',
  page: 1, pageSize: 10
});

watch(createRange, (v) => { query.start_date = v?.[0] || ''; query.end_date = v?.[1] || ''; });
watch(finishRange, (v) => { query.finish_start = v?.[0] || ''; query.finish_end = v?.[1] || ''; });
watch(maintenanceExpireRange, (v) => { query.maintenance_expire_start = v?.[0] || ''; query.maintenance_expire_end = v?.[1] || ''; });

async function load() {
  loading.value = true;
  try {
    const data = await api.listProjects(query);
    list.value = data.list;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}
function reload() { query.page = 1; load(); }
function resetQuery() {
  Object.assign(query, { keyword: '', project_type: '', status: '', status_group: '', payment_requested: '', tech_id: '', settled: '', server_first_push: '', server_owner: '', tag_id: '', start_date: '', end_date: '', finish_start: '', finish_end: '', maintenance_expire_start: '', maintenance_expire_end: '', page: 1 });
  createRange.value = []; finishRange.value = []; maintenanceExpireRange.value = [];
  load();
}

async function onExport() {
  await api.exportProjects(query);
  ElMessage.success('导出中，请稍候下载');
}

async function onDelete(row) {
  await ElMessageBox.confirm(`确认删除项目「${row.name}」？（逻辑软删除）`, '提示', { type: 'warning' });
  await api.deleteProject(row.id);
  ElMessage.success('已删除');
  load();
}
async function onBatchDelete() {
  await ElMessageBox.confirm(`确认删除选中的 ${selection.value.length} 个项目？`, '提示', { type: 'warning' });
  await api.batchDeleteProjects(selection.value.map((r) => r.id));
  ElMessage.success('批量删除成功');
  load();
}

// 分配
const assignDialog = ref(false);
const assignTechId = ref(null);
const assignRow = ref(null);
function openAssign(row) { assignRow.value = row; assignTechId.value = row.tech_id; assignDialog.value = true; }
async function confirmAssign() {
  if (!assignTechId.value) return ElMessage.warning('请选择技术员');
  await api.assignProject(assignRow.value.id, assignTechId.value);
  ElMessage.success('分配成功');
  assignDialog.value = false;
  load();
}

onMounted(async () => {
  [techs.value, tags.value] = await Promise.all([api.techOptions(), api.listTags()]);
  if (route.query.status) query.status = route.query.status;
  if (route.query.status_group) query.status_group = route.query.status_group;
  if (route.query.payment_requested !== undefined) query.payment_requested = Number(route.query.payment_requested);
  if (route.query.project_type) query.project_type = Number(route.query.project_type);
  load();
});
</script>

<style scoped>
.project-filter-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(220px, 1fr));
  gap: 12px;
  align-items: center;
}

.filter-date-range {
  width: 100%;
}

.filter-date-group {
  grid-column: span 2;
  min-width: 0;
}

.filter-date-label {
  margin-bottom: 6px;
  font-size: 12px;
  line-height: 1;
  color: #86868b;
}

:deep(.filter-date-range.el-date-editor.el-input__wrapper) {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

:deep(.filter-date-range .el-range-input) {
  min-width: 0;
}

.filter-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-start;
  grid-column: 1 / -1;
}

@media (max-width: 1280px) {
  .project-filter-grid {
    grid-template-columns: repeat(2, minmax(240px, 1fr));
  }
}

@media (max-width: 768px) {
  .project-filter-grid {
    grid-template-columns: 1fr;
  }

  .filter-date-range {
    width: 100%;
  }

  .filter-date-group {
    grid-column: span 1;
  }
}
</style>
