<template>
  <div class="max-w-xl">
    <div class="mb-6"><h2 class="page-title">个人中心</h2></div>
    <div class="apple-card mb-4">
      <div class="flex items-center gap-4 mb-4">
        <el-avatar :size="60" class="bg-apple-blue">{{ user?.name?.[0] }}</el-avatar>
        <div>
          <div class="text-lg font-medium">{{ user?.name }}</div>
          <div class="text-apple-gray text-sm">{{ user?.username }} · {{ user?.role==='admin'?'管理员':'技术员' }}</div>
        </div>
      </div>
      <InfoRow label="联系方式" :value="me?.phone" />
      <InfoRow label="账号状态" :value="me?.status===1?'启用':'禁用'" />
      <InfoRow label="注册时间" :value="me?.created_at" />
    </div>

    <div class="apple-card">
      <div class="font-medium mb-4">修改密码</div>
      <el-form :model="pwd" :rules="rules" ref="pwdRef" label-width="90px">
        <el-form-item label="旧密码" prop="oldPassword"><el-input v-model="pwd.oldPassword" type="password" show-password /></el-form-item>
        <el-form-item label="新密码" prop="newPassword"><el-input v-model="pwd.newPassword" type="password" show-password /></el-form-item>
        <el-button type="primary" @click="changePwd">修改密码</el-button>
      </el-form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, h } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '@/api';
import { useUserStore } from '@/store/user';

const InfoRow = (props) => h('div', { class: 'flex justify-between py-2 border-b border-apple-line last:border-0' }, [
  h('span', { class: 'text-apple-gray' }, props.label),
  h('span', {}, props.value || '—')
]);
InfoRow.props = ['label', 'value'];

const store = useUserStore();
const user = computed(() => store.user);
const me = ref(null);
const pwdRef = ref();
const pwd = reactive({ oldPassword: '', newPassword: '' });
const rules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }, { min: 6, message: '至少6位', trigger: 'blur' }]
};

async function changePwd() {
  await pwdRef.value.validate();
  await api.changePassword(pwd);
  ElMessage.success('密码修改成功');
  pwd.oldPassword = ''; pwd.newPassword = '';
}

onMounted(async () => { me.value = await api.me(); });
</script>
