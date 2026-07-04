/**
 * axios 封装 + 全量接口定义
 */
import axios from 'axios';
import { ElMessage } from 'element-plus';
import router from '@/router';

const http = axios.create({
  baseURL: '/api',
  timeout: 300000
});

// 请求拦截：附带 token
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 响应拦截：统一异常处理
http.interceptors.response.use(
  (res) => {
    // Blob（导出）直接返回
    if (res.config.responseType === 'blob') return res;
    const data = res.data;
    if (data.code !== 0) {
      ElMessage.error(data.message || '请求失败');
      return Promise.reject(data);
    }
    return data.data;
  },
  (err) => {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message || '网络错误';
    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      router.push('/login');
    }
    ElMessage.error(msg);
    return Promise.reject(err);
  }
);

// 下载 blob 辅助
async function download(url, params, filename) {
  const res = await http.get(url, { params, responseType: 'blob' });
  const blob = new Blob([res.data]);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename || 'export.xlsx';
  link.click();
  URL.revokeObjectURL(link.href);
}

export default http;

export const api = {
  // 认证
  login: (data) => http.post('/auth/login', data),
  me: () => http.get('/auth/me'),
  updateBankAccount: (data) => http.put('/auth/me/bank-account', data),
  changePassword: (data) => http.post('/auth/change-password', data),

  // 用户管理
  listUsers: (params) => http.get('/users', { params }),
  createUser: (data) => http.post('/users', data),
  batchCreateUsers: (list) => http.post('/users/batch', { list }),
  updateUser: (id, data) => http.put(`/users/${id}`, data),
  toggleUserStatus: (id, status) => http.patch(`/users/${id}/status`, { status }),
  deleteUser: (id) => http.delete(`/users/${id}`),

  // 项目
  listProjects: (params) => http.get('/projects', { params }),
  getProject: (id) => http.get(`/projects/${id}`),
  createProject: (data) => http.post('/projects', data),
  updateProject: (id, data) => http.put(`/projects/${id}`, data),
  assignProject: (id, tech_id) => http.patch(`/projects/${id}/assign`, { tech_id }),
  progressProject: (id, data) => http.patch(`/projects/${id}/progress`, data),
  deleteProject: (id) => http.delete(`/projects/${id}`),
  batchDeleteProjects: (ids) => http.post('/projects/batch-delete', { ids }),
  exportProjects: (params) => download('/projects/export/excel', params, `项目列表_${Date.now()}.xlsx`),

  // 附件
  uploadFiles: (projectId, formData, onProgress) =>
    http.post(`/files/${projectId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
    }),
  downloadFile: (fileId, name) => download(`/files/${fileId}/download`, {}, name),
  deleteFile: (fileId) => http.delete(`/files/${fileId}`),

  // 大屏
  dashboard: (params) => http.get('/dashboard', { params }),

  // 台账
  listLedger: (params) => http.get('/ledger', { params }),
  addLedger: (data) => http.post('/ledger', data),
  deleteLedger: (id) => http.delete(`/ledger/${id}`),
  exportLedger: (params) => download('/ledger/export/excel', params, `资金台账_${Date.now()}.xlsx`),

  // 杂项
  listLogs: (params) => http.get('/logs', { params }),
  listTags: () => http.get('/tags'),
  createTag: (data) => http.post('/tags', data),
  updateTag: (id, data) => http.put(`/tags/${id}`, data),
  deleteTag: (id) => http.delete(`/tags/${id}`),
  getSettings: () => http.get('/settings'),
  updateSettings: (data) => http.put('/settings', data),
  performance: () => http.get('/performance'),
  techSummary: () => http.get('/tech-summary'),
  overdue: () => http.get('/overdue'),
  expireWarning: (days) => http.get('/expire-warning', { params: { days } }),
  maintenanceReport: () => http.get('/maintenance-report'),
  techOptions: () => http.get('/options/techs'),
  projectOptions: () => http.get('/options/projects')
};
