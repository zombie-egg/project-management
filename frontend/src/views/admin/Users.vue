<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div><h2 class="page-title">人员账号管理</h2><p class="page-sub">创建、编辑、禁用技术员账号</p></div>
      <div class="flex gap-3">
        <el-button type="primary" :icon="Plus" @click="openCreate">新增技术员</el-button>
        <el-button :icon="Upload" @click="batchDialog=true">批量创建</el-button>
      </div>
    </div>

    <div class="apple-card mb-4">
      <el-input v-model="keyword" placeholder="搜索账号/姓名/电话/银行卡" clearable :prefix-icon="Search" class="max-w-xs" @keyup.enter="load" @clear="load" />
    </div>

    <div class="apple-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="60" />
        <el-table-column prop="username" label="账号" width="130" />
        <el-table-column prop="name" label="姓名" width="120" />
        <el-table-column label="角色" width="90">
          <template #default="{ row }"><el-tag size="small" :type="row.role==='admin'?'danger':''">{{ row.role==='admin'?'管理员':'技术员' }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="phone" label="联系方式" width="140" />
        <el-table-column prop="bank_account" label="银行卡号" min-width="170" show-overflow-tooltip />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-switch v-if="row.role!=='admin'" :model-value="row.status===1" @change="(v)=>toggleStatus(row,v)" inline-prompt active-text="启用" inactive-text="禁用" />
            <el-tag v-else type="success" size="small">启用</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <template v-if="row.role!=='admin'">
              <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button link type="warning" size="small" @click="openReset(row)">重置密码</el-button>
              <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
            </template>
            <span v-else class="text-apple-gray text-sm">—</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialog" :title="editing ? '编辑技术员' : '新增技术员'" width="460px">
      <el-form :model="form" :rules="rules" ref="formRef" label-width="90px">
        <el-form-item label="账号" prop="username"><el-input v-model="form.username" :disabled="editing" /></el-form-item>
        <el-form-item label="姓名" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item :label="editing?'新密码':'密码'" :prop="editing?'':'password'">
          <el-input v-model="form.password" type="password" show-password :placeholder="editing?'留空则不修改':'初始密码'" />
        </el-form-item>
        <el-form-item label="联系方式"><el-input v-model="form.phone" /></el-form-item>
        <el-form-item label="银行卡号"><el-input v-model="form.bank_account" /></el-form-item>
        <el-form-item label="状态"><el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" inline-prompt /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" @click="onSubmit">保存</el-button></template>
    </el-dialog>

    <!-- 批量创建 -->
    <el-dialog v-model="batchDialog" title="批量创建技术员" width="560px">
      <div class="text-sm text-apple-gray mb-2">每行一个账号，格式：<code>账号,密码,姓名,联系方式,银行卡号</code>（后两项可省略）</div>
      <el-input v-model="batchText" type="textarea" :rows="8" placeholder="tech03,123456,王五,13900000005&#10;tech04,123456,赵六" />
      <template #footer><el-button @click="batchDialog=false">取消</el-button><el-button type="primary" @click="onBatch">批量创建</el-button></template>
    </el-dialog>

    <!-- 账号分发 -->
    <el-dialog v-model="distributeDialog" title="技术员账号分发" width="620px">
      <el-alert type="success" :closable="false" show-icon class="mb-3">
        <template #title>账号已创建，请把以下登录信息分发给技术员。初始密码仅本次显示。</template>
      </el-alert>
      <el-table :data="createdAccounts" border size="small">
        <el-table-column prop="name" label="姓名" width="110" />
        <el-table-column prop="username" label="登录账号" min-width="130" />
        <el-table-column prop="password" label="初始密码" min-width="130" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }"><el-tag size="small" :type="row.status ? 'success' : 'info'">{{ row.status ? '启用' : '禁用' }}</el-tag></template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="copyAccounts">复制账号信息</el-button>
        <el-button type="primary" @click="distributeDialog=false">完成</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Upload, Search } from '@element-plus/icons-vue';
import { api } from '@/api';

const loading = ref(false);
const list = ref([]);
const keyword = ref('');
const dialog = ref(false);
const editing = ref(false);
const distributeDialog = ref(false);
const createdAccounts = ref([]);
const formRef = ref();
const form = reactive({ id: null, username: '', name: '', password: '', phone: '', bank_account: '', status: 1 });
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

async function load() {
  loading.value = true;
  try { list.value = await api.listUsers({ keyword: keyword.value }); }
  finally { loading.value = false; }
}

function openCreate() {
  editing.value = false;
  Object.assign(form, { id: null, username: '', name: '', password: '', phone: '', bank_account: '', status: 1 });
  dialog.value = true;
}
function openEdit(row) {
  editing.value = true;
  Object.assign(form, { id: row.id, username: row.username, name: row.name, password: '', phone: row.phone, bank_account: row.bank_account || '', status: row.status });
  dialog.value = true;
}
function openReset(row) {
  ElMessageBox.prompt(`为「${row.name}」设置新密码`, '重置密码', { inputType: 'password', inputPattern: /.{6,}/, inputErrorMessage: '密码至少6位' })
    .then(async ({ value }) => { await api.updateUser(row.id, { password: value }); ElMessage.success('密码已重置'); })
    .catch(() => {});
}

async function onSubmit() {
  await formRef.value.validate();
  if (editing.value) {
    const payload = { name: form.name, phone: form.phone, bank_account: form.bank_account, status: form.status };
    if (form.password) payload.password = form.password;
    await api.updateUser(form.id, payload);
  } else {
    const res = await api.createUser(form);
    createdAccounts.value = res.account ? [res.account] : [];
    distributeDialog.value = createdAccounts.value.length > 0;
  }
  ElMessage.success('保存成功');
  dialog.value = false;
  load();
}

async function toggleStatus(row, v) {
  await api.toggleUserStatus(row.id, v ? 1 : 0);
  ElMessage.success(v ? '已启用' : '已禁用');
  load();
}
async function onDelete(row) {
  await ElMessageBox.confirm(`确认删除账号「${row.username}」？`, '提示', { type: 'warning' });
  await api.deleteUser(row.id);
  ElMessage.success('已删除');
  load();
}

const batchDialog = ref(false);
const batchText = ref('');
async function onBatch() {
  const rows = batchText.value.split('\n').map((l) => l.trim()).filter(Boolean);
  const list2 = rows.map((l) => {
    const [username, password, name, phone, bank_account] = l.split(',').map((s) => (s || '').trim());
    return { username, password, name, phone, bank_account };
  });
  const res = await api.batchCreateUsers(list2);
  ElMessage.success(`成功 ${res.success} 个，失败 ${res.failed.length} 个`);
  createdAccounts.value = res.created || [];
  distributeDialog.value = createdAccounts.value.length > 0;
  batchDialog.value = false;
  batchText.value = '';
  load();
}

async function copyAccounts() {
  const text = createdAccounts.value
    .map((a) => `姓名：${a.name}\n登录账号：${a.username}\n初始密码：${a.password}\n登录入口：${window.location.origin}/#/login`)
    .join('\n\n');
  await navigator.clipboard.writeText(text);
  ElMessage.success('账号信息已复制');
}

onMounted(load);
</script>
