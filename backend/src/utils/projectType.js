const PROJECT_TYPE = {
  NORMAL: 1,
  HISTORY: 2
};

function normalizeProjectType(value, fallback = PROJECT_TYPE.NORMAL) {
  if (value === undefined || value === null || value === '') return fallback;
  const raw = String(value).trim().toLowerCase();
  if (raw === '2' || raw === '2.0' || raw === 'maintenance' || raw === 'history' || raw === 'old') return PROJECT_TYPE.HISTORY;
  return PROJECT_TYPE.NORMAL;
}

function parseProjectTypeFilter(value) {
  if (value === undefined || value === null || value === '') return null;
  return normalizeProjectType(value);
}

function isHistoryProject(project) {
  return normalizeProjectType(project && project.project_type) === PROJECT_TYPE.HISTORY;
}

function isNormalProject(project) {
  return normalizeProjectType(project && project.project_type) === PROJECT_TYPE.NORMAL;
}

function projectTypeLabel(value) {
  return normalizeProjectType(value) === PROJECT_TYPE.HISTORY ? '历史维护完结项目' : '常规开发项目';
}

function projectTypeWhere(alias, type) {
  const col = alias ? `${alias}.project_type` : 'project_type';
  if (type === PROJECT_TYPE.HISTORY) return `${col} IN (2,'2','2.0','maintenance')`;
  return `${col} IN (1,'1','1.0','normal')`;
}

module.exports = {
  PROJECT_TYPE,
  normalizeProjectType,
  parseProjectTypeFilter,
  isHistoryProject,
  isNormalProject,
  projectTypeLabel,
  projectTypeWhere
};
