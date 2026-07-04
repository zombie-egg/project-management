import { createRouter, createWebHashHistory } from 'vue-router';

const routes = [
  { path: '/login', component: () => import('@/views/Login.vue'), meta: { public: true } },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      // 管理员
      { path: 'dashboard', name: 'dashboard', component: () => import('@/views/admin/Dashboard.vue'), meta: { admin: true, title: '数据大屏' } },
      { path: 'projects', name: 'projects', component: () => import('@/views/admin/ProjectList.vue'), meta: { admin: true, title: '项目管理' } },
      { path: 'projects/new', name: 'project-new', component: () => import('@/views/admin/ProjectForm.vue'), meta: { admin: true, title: '录入项目' } },
      { path: 'projects/:id/edit', name: 'project-edit', component: () => import('@/views/admin/ProjectForm.vue'), meta: { admin: true, title: '编辑项目' } },
      { path: 'projects/:id', name: 'project-detail', component: () => import('@/views/ProjectDetail.vue'), meta: { title: '项目详情' } },
      { path: 'users', name: 'users', component: () => import('@/views/admin/Users.vue'), meta: { admin: true, title: '人员账号' } },
      { path: 'ledger', name: 'ledger', component: () => import('@/views/admin/Ledger.vue'), meta: { admin: true, title: '资金台账' } },
      { path: 'maintenance', name: 'maintenance', component: () => import('@/views/admin/MaintenanceReport.vue'), meta: { admin: true, title: '旧项目台账' } },
      { path: 'overdue', name: 'overdue', component: () => import('@/views/admin/Overdue.vue'), meta: { admin: true, title: '回款逾期' } },
      { path: 'performance', name: 'performance', component: () => import('@/views/admin/Performance.vue'), meta: { admin: true, title: '技术员业绩' } },
      { path: 'tags', name: 'tags', component: () => import('@/views/admin/Tags.vue'), meta: { admin: true, title: '标签管理' } },
      { path: 'logs', name: 'logs', component: () => import('@/views/admin/Logs.vue'), meta: { admin: true, title: '操作日志' } },
      { path: 'settings', name: 'settings', component: () => import('@/views/admin/Settings.vue'), meta: { admin: true, title: '系统设置' } },
      // 技术员
      { path: 'my-projects', name: 'my-projects', component: () => import('@/views/tech/MyProjects.vue'), meta: { tech: true, title: '我的项目' } },
      // 通用
      { path: 'profile', name: 'profile', component: () => import('@/views/Profile.vue'), meta: { title: '个人中心' } }
    ]
  }
];

const router = createRouter({
  history: createWebHashHistory(),
  routes
});

router.beforeEach((to) => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  if (to.meta.public) return true;
  if (!token) return '/login';
  // 角色路由守卫
  if (to.meta.admin && user?.role !== 'admin') return '/my-projects';
  if (to.meta.tech && user?.role !== 'tech') return '/dashboard';
  return true;
});

export default router;
