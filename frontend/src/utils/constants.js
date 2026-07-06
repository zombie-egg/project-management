// 项目状态定义（常规项目5阶段流转）
export const STATUS_FLOW = ['pending', 'stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'completed'];

export const STATUS_LABEL = {
  pending: '待接单',
  stage1: '接单',
  stage2: '初版展示',
  stage3: '终版修改',
  stage4: '完成源码上传',
  stage5: '提交付款申请',
  completed: '已完工'
};

export const STATUS_TAG_TYPE = {
  pending: 'info',
  stage1: '',
  stage2: 'warning',
  stage3: 'warning',
  stage4: 'primary',
  stage5: 'success',
  completed: 'success'
};

// 技术员进度流转步骤（不含 pending / completed 的中间态展示）
export const TECH_STEPS = [
  { key: 'stage1', label: '接单' },
  { key: 'stage2', label: '初版展示' },
  { key: 'stage3', label: '终版修改' },
  { key: 'stage4', label: '完成源码上传' },
  { key: 'stage5', label: '提交付款申请' }
];

export const PROJECT_TYPE_LABEL = {
  1: '常规开发项目',
  2: '历史维护完结项目',
  normal: '常规开发项目',
  maintenance: '历史维护完结项目'
};

export function projectTypeValue(v) {
  return Number(v) === 2 || v === 'maintenance' ? 2 : 1;
}

export function isHistoryProject(v) {
  return projectTypeValue(v) === 2;
}

export function projectTypeShortLabel(v) {
  return isHistoryProject(v) ? '历史' : '常规';
}

export const LEDGER_TYPE_LABEL = {
  first: '首付款', mid: '中期款', final: '尾款',
  maintenance: '维护款', cost: '成本支出', techfee: '技术费用', other: '其他'
};

export function money(n) {
  const v = Number(n) || 0;
  return '¥' + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
