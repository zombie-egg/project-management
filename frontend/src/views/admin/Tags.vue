<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div><h2 class="page-title">项目标签管理</h2><p class="page-sub">自定义标签用于分类筛选统计</p></div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增标签</el-button>
    </div>

    <div class="apple-card">
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="标签" min-width="200">
          <template #default="{ row }"><el-tag :style="{ color: row.color, borderColor: row.color }" effect="plain">{{ row.name }}</el-tag></template>
        </el-table-column>
        <el-table-column label="颜色" width="120"><template #default="{ row }"><span class="inline-block w-5 h-5 rounded" :style="{ background: row.color }"></span></template></el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialog" :title="editing?'编辑标签':'新增标签'" width="400px">
      <el-form :model="form" label-width="70px">
        <el-form-item label="名称" required><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="颜色"><el-color-picker v-model="form.color" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialog=false">取消</el-button><el-button type="primary" @click="onSubmit">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { api } from '@/api';

const loading = ref(false);
const list = ref([]);
const dialog = ref(false);
const editing = ref(false);
const form = reactive({ id: null, name: '', color: '#0071e3' });

async function load() { loading.value = true; try { list.value = await api.listTags(); } finally { loading.value = false; } }
function openCreate() { editing.value = false; Object.assign(form, { id: null, name: '', color: '#0071e3' }); dialog.value = true; }
function openEdit(row) { editing.value = true; Object.assign(form, { id: row.id, name: row.name, color: row.color }); dialog.value = true; }
async function onSubmit() {
  if (!form.name) return ElMessage.warning('请输入标签名称');
  if (editing.value) await api.updateTag(form.id, { name: form.name, color: form.color });
  else await api.createTag({ name: form.name, color: form.color });
  ElMessage.success('保存成功'); dialog.value = false; load();
}
async function onDelete(row) {
  await ElMessageBox.confirm(`确认删除标签「${row.name}」？`, '提示', { type: 'warning' });
  await api.deleteTag(row.id); ElMessage.success('已删除'); load();
}
onMounted(load);
</script>
