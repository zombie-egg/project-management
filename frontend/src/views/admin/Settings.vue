<template>
  <div class="max-w-2xl">
    <div class="mb-6"><h2 class="page-title">系统基础设置</h2><p class="page-sub">上传配置 · 大屏主题</p></div>

    <div class="apple-card mb-4">
      <el-form :model="form" label-width="160px">
        <el-form-item label="文件上传路径">
          <el-input v-model="form.upload_dir" placeholder="留空使用默认 uploads 目录" />
          <div class="text-xs text-apple-gray mt-1">服务器绝对路径，修改后新上传文件将保存至此</div>
        </el-form-item>
        <el-form-item label="单文件大小限制(MB)">
          <el-input-number v-model="form.max_file_size_mb" :min="1" :max="2048" controls-position="right" />
        </el-form-item>
        <el-form-item label="数据大屏主题">
          <el-radio-group v-model="form.dashboard_theme">
            <el-radio value="light">浅色</el-radio>
            <el-radio value="dark">暗色</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-button type="primary" @click="save">保存设置</el-button>
      </el-form>
    </div>

    <div class="apple-card">
      <div class="font-medium mb-4">修改登录密码</div>
      <el-form :model="pwd" :rules="rules" ref="pwdRef" label-width="160px">
        <el-form-item label="旧密码" prop="oldPassword"><el-input v-model="pwd.oldPassword" type="password" show-password /></el-form-item>
        <el-form-item label="新密码" prop="newPassword"><el-input v-model="pwd.newPassword" type="password" show-password /></el-form-item>
        <el-button type="primary" @click="changePwd">修改密码</el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/api';

const form = reactive({ upload_dir: '', max_file_size_mb: 200, dashboard_theme: 'light' });
const pwd = reactive({ oldPassword: '', newPassword: '' });
const pwdRef = ref();
const rules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }, { min: 6, message: '至少6位', trigger: 'blur' }]
};

async function save() {
  await api.updateSettings({ upload_dir: form.upload_dir, max_file_size_mb: String(form.max_file_size_mb), dashboard_theme: form.dashboard_theme });
  ElMessage.success('设置已保存');
}
async function changePwd() {
  await pwdRef.value.validate();
  await api.changePassword(pwd);
  ElMessage.success('密码修改成功');
  pwd.oldPassword = ''; pwd.newPassword = '';
}

onMounted(async () => {
  const s = await api.getSettings();
  form.upload_dir = s.upload_dir || '';
  form.max_file_size_mb = Number(s.max_file_size_mb) || 200;
  form.dashboard_theme = s.dashboard_theme || 'light';
});
</script>
