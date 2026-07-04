<template>
  <el-container class="h-screen">
    <!-- 侧边栏 -->
    <el-aside width="220px" class="bg-white border-r border-apple-line flex flex-col">
      <div class="h-16 flex items-center px-6 border-b border-apple-line">
        <span class="text-lg font-semibold text-apple-black">项目管理后台</span>
      </div>
      <el-menu
        :default-active="$route.path"
        router
        class="border-0 flex-1"
        background-color="#ffffff"
        text-color="#1d1d1f"
        active-text-color="#0071e3"
      >
        <template v-for="item in menus" :key="item.path">
          <el-menu-item :index="item.path">
            <el-icon><component :is="item.icon" /></el-icon>
            <span>{{ item.title }}</span>
          </el-menu-item>
        </template>
      </el-menu>
    </el-aside>

    <el-container>
      <!-- 顶栏 -->
      <el-header class="bg-white border-b border-apple-line flex items-center justify-between px-6">
        <div class="text-base font-medium text-apple-black">{{ $route.meta.title || '' }}</div>
        <div class="flex items-center gap-4">
          <el-tag v-if="warning.length" type="danger" effect="light" class="cursor-pointer" @click="goOverdue">
            <el-icon class="mr-1"><Warning /></el-icon>
            {{ warning.length }} 个服务器/维护费即将到期/已过期
          </el-tag>
          <el-dropdown @command="onCommand">
            <span class="flex items-center gap-2 cursor-pointer text-apple-black">
              <el-avatar :size="30" class="bg-apple-blue">{{ user?.name?.[0] || 'U' }}</el-avatar>
              <span>{{ user?.name }}</span>
              <el-tag size="small" effect="plain">{{ user?.role === 'admin' ? '管理员' : '技术员' }}</el-tag>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="bg-apple-bg p-6 overflow-auto">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useUserStore } from '@/store/user';
import { api } from '@/api';

const router = useRouter();
const store = useUserStore();
const user = computed(() => store.user);
const warning = ref([]);

const adminMenus = [
  { path: '/dashboard', title: '数据大屏', icon: 'DataAnalysis' },
  { path: '/projects', title: '项目管理', icon: 'Folder' },
  { path: '/projects/new', title: '录入项目', icon: 'DocumentAdd' },
  { path: '/users', title: '人员账号', icon: 'User' },
  { path: '/ledger', title: '资金台账', icon: 'Money' },
  { path: '/maintenance', title: '旧项目台账', icon: 'Files' },
  { path: '/overdue', title: '回款逾期', icon: 'Warning' },
  { path: '/performance', title: '技术员业绩', icon: 'TrendCharts' },
  { path: '/tags', title: '标签管理', icon: 'CollectionTag' },
  { path: '/logs', title: '操作日志', icon: 'Tickets' },
  { path: '/settings', title: '系统设置', icon: 'Setting' }
];
const techMenus = [
  { path: '/tech-summary', title: '我的汇总', icon: 'DataAnalysis' },
  { path: '/my-projects', title: '我的项目', icon: 'Folder' }
];

const menus = computed(() => (store.isAdmin ? adminMenus : techMenus));

function onCommand(cmd) {
  if (cmd === 'profile') router.push('/profile');
  if (cmd === 'logout') {
    ElMessageBox.confirm('确认退出登录？', '提示', { type: 'warning' }).then(() => {
      store.logout();
      router.push('/login');
    }).catch(() => {});
  }
}

function goOverdue() {
  router.push('/overdue');
}

onMounted(async () => {
  if (store.isAdmin) {
    try { warning.value = await api.expireWarning(30); } catch (e) { /* ignore */ }
  }
});
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
:deep(.el-menu-item.is-active) { background: #f5f5f7; border-radius: 8px; }
:deep(.el-menu-item) { margin: 2px 8px; height: 44px; border-radius: 8px; }
</style>
