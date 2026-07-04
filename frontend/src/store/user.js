import { defineStore } from 'pinia';
import { api } from '@/api';

export const useUserStore = defineStore('user', {
  state: () => ({
    token: localStorage.getItem('token') || '',
    user: JSON.parse(localStorage.getItem('user') || 'null')
  }),
  getters: {
    isAdmin: (s) => s.user?.role === 'admin',
    isTech: (s) => s.user?.role === 'tech',
    isLogin: (s) => !!s.token
  },
  actions: {
    async login(payload) {
      const data = await api.login(payload);
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      return data;
    },
    logout() {
      this.token = '';
      this.user = null;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  }
});
