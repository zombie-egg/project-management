<template>
  <div class="min-h-screen flex items-center justify-center bg-apple-bg">
    <div class="w-full max-w-md px-8">
      <div class="text-center mb-10">
        <h1 class="text-3xl font-semibold text-apple-black">项目接单管理后台</h1>
        <p class="text-apple-gray mt-2">Project Management System</p>
      </div>
      <div class="apple-card">
        <el-form :model="form" :rules="rules" ref="formRef" @submit.prevent="onSubmit" size="large">
          <el-form-item prop="username">
            <el-input v-model="form.username" placeholder="登录账号" :prefix-icon="User" />
          </el-form-item>
          <el-form-item prop="password">
            <el-input v-model="form.password" type="password" show-password placeholder="登录密码" :prefix-icon="Lock" @keyup.enter="onSubmit" />
          </el-form-item>
          <el-button type="primary" class="w-full" :loading="loading" @click="onSubmit">登 录</el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { User, Lock } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { useUserStore } from '@/store/user';

const router = useRouter();
const store = useUserStore();
const formRef = ref();
const loading = ref(false);
const form = reactive({ username: '', password: '' });
const rules = {
  username: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
};

async function onSubmit() {
  await formRef.value.validate();
  loading.value = true;
  try {
    const data = await store.login(form);
    ElMessage.success('登录成功');
    router.push(data.user.role === 'admin' ? '/dashboard' : '/my-projects');
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    loading.value = false;
  }
}
</script>
