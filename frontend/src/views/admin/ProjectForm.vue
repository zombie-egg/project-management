<template>
  <div class="max-w-4xl mx-auto">
    <div class="flex items-center justify-between mb-6">
      <h2 class="page-title">{{ isEdit ? '编辑项目' : '录入项目' }}</h2>
      <el-button @click="$router.back()">返回</el-button>
    </div>

    <el-form :model="form" :rules="rules" ref="formRef" label-position="top" class="apple-card">
      <!-- 项目类型切换 -->
      <el-form-item label="项目类型" prop="project_type" required>
        <el-radio-group v-model="form.project_type" @change="onTypeChange">
          <el-radio-button :value="1">常规开发项目</el-radio-button>
          <el-radio-button :value="2">历史维护完结项目</el-radio-button>
        </el-radio-group>
        <div class="text-xs text-apple-gray mt-2">
          {{ isHistoryProject(form.project_type)
            ? '历史维护完结项目：不分配技术员、不推送、技术员不可见，仅管理员留档统计，状态固定「已完工」'
            : '常规项目：可分配技术员，正常进度流转并推送技术员后台' }}
        </div>
      </el-form-item>

      <el-divider content-position="left">基础信息（必填）</el-divider>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4">
        <el-form-item label="项目名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="项目工期" prop="duration"><el-input v-model="form.duration" placeholder="如 30天" /></el-form-item>
        <el-form-item label="项目群名"><el-input v-model="form.group_name" placeholder="如 客户交付群/微信群名" /></el-form-item>
        <el-form-item label="客户姓名" prop="customer_name"><el-input v-model="form.customer_name" /></el-form-item>
        <el-form-item label="客户联系方式" prop="customer_phone"><el-input v-model="form.customer_phone" /></el-form-item>
      </div>
      <el-form-item label="项目描述" prop="description"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
      <el-form-item label="项目要求" prop="requirement"><el-input v-model="form.requirement" type="textarea" :rows="3" placeholder="项目需求说明，附件可在下方上传" /></el-form-item>

      <!-- 附件上传 -->
      <el-form-item label="项目需求附件（文档/图片/视频，单文件≤200MB，可多传）">
        <div class="w-full">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            multiple
            :on-change="onFileChange"
            :file-list="pendingFiles"
            :on-remove="onFileRemove"
          >
            <el-button :icon="Upload">选择文件</el-button>
          </el-upload>
          <!-- 编辑模式：已上传附件 -->
          <div v-if="isEdit && existingFiles.length" class="mt-3">
            <div class="text-sm text-apple-gray mb-2">已上传附件：</div>
            <div v-for="f in existingFiles" :key="f.id" class="flex items-center justify-between py-1 px-3 bg-apple-bg rounded mb-1">
              <span class="text-sm">{{ f.original_name }} <span class="text-apple-gray">({{ (f.size/1024/1024).toFixed(2) }}MB)</span></span>
              <div class="flex gap-2">
                <el-button link type="primary" size="small" @click="downloadFile(f)">下载</el-button>
                <el-button link type="danger" size="small" @click="removeExisting(f)">删除</el-button>
              </div>
            </div>
          </div>
        </div>
      </el-form-item>

      <!-- 分配技术员：仅常规项目 -->
      <template v-if="!isHistoryProject(form.project_type)">
        <el-divider content-position="left">分配技术员</el-divider>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <el-form-item label="分配技术员（可留空，后续再分配）">
            <el-select v-model="form.tech_id" clearable placeholder="选择技术员" class="w-full">
              <el-option v-for="t in techs" :key="t.id" :label="`${t.name}（${t.username}）`" :value="t.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="项目状态">
            <el-select v-model="form.status" class="w-full" placeholder="选择项目状态">
              <el-option v-for="(v,k) in STATUS_LABEL" :key="k" :label="v" :value="k" />
            </el-select>
          </el-form-item>
        </div>
      </template>

      <el-divider content-position="left">选填信息</el-divider>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-x-4">
        <el-form-item label="项目开始时间"><el-date-picker v-model="form.start_time" type="date" value-format="YYYY-MM-DD" class="w-full" /></el-form-item>
        <el-form-item label="项目实际完工时间"><el-date-picker v-model="form.actual_finish_time" type="date" value-format="YYYY-MM-DD" class="w-full" /></el-form-item>
        <el-form-item label="开发总酬劳"><el-input-number v-model="form.total_reward" :min="0" :precision="2" class="w-full" controls-position="right" /></el-form-item>
        <el-form-item label="首付款"><el-input-number v-model="form.first_payment" :min="0" :precision="2" class="w-full" controls-position="right" /></el-form-item>
        <el-form-item label="中期款"><el-input-number v-model="form.mid_payment" :min="0" :precision="2" class="w-full" controls-position="right" /></el-form-item>
        <el-form-item label="尾款"><el-input-number v-model="form.final_payment" :min="0" :precision="2" class="w-full" controls-position="right" /></el-form-item>
        <el-form-item label="项目成本金额"><el-input-number v-model="form.project_cost" :min="0" :precision="2" class="w-full" controls-position="right" /></el-form-item>
        <el-form-item label="技术费用"><el-input-number v-model="form.tech_fee" :min="0" :precision="2" class="w-full" controls-position="right" /></el-form-item>
        <el-form-item label="源码是否提交">
          <el-select v-model="form.source_uploaded" clearable placeholder="请选择" class="w-full">
            <el-option label="是" :value="1" />
            <el-option label="否" :value="0" />
          </el-select>
        </el-form-item>
      </div>

      <!-- 利润实时预览 -->
      <div class="bg-apple-bg rounded-lg p-4 mb-4 flex gap-8">
        <div><span class="text-apple-gray text-sm">合计收入：</span><span class="font-semibold text-apple-blue">{{ money(income) }}</span></div>
        <div><span class="text-apple-gray text-sm">项目利润：</span><span class="font-semibold" style="color:#34c759">{{ money(profit) }}</span></div>
        <div class="text-xs text-apple-gray self-center">利润 =（首付+中期+尾款）- 成本 - 技术费用</div>
      </div>

      <el-divider content-position="left">维护费信息</el-divider>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-x-4">
        <el-form-item label="维护金额"><el-input-number v-model="form.maintenance_amount" :min="0" :precision="2" class="w-full" controls-position="right" /></el-form-item>
        <el-form-item label="维护费到期时间"><el-date-picker v-model="form.maintenance_expire_date" type="date" value-format="YYYY-MM-DD" class="w-full" /></el-form-item>
      </div>

      <el-divider content-position="left">服务器信息</el-divider>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-x-4">
        <el-form-item label="服务器是否首推">
          <el-select v-model="form.server_first_push" clearable class="w-full"><el-option label="是" value="是" /><el-option label="否" value="否" /></el-select>
        </el-form-item>
        <el-form-item label="服务器终推归属">
          <el-select v-model="form.server_owner" clearable class="w-full"><el-option label="个人" value="个人" /><el-option label="公司" value="公司" /></el-select>
        </el-form-item>
        <el-form-item label="服务器位置"><el-input v-model="form.server_location" placeholder="如 阿里云华东/腾讯云广州" /></el-form-item>
        <el-form-item label="服务器开始日期"><el-date-picker v-model="form.server_start_date" type="date" value-format="YYYY-MM-DD" class="w-full" /></el-form-item>
        <el-form-item label="服务器购买时间"><el-date-picker v-model="form.server_buy_date" type="date" value-format="YYYY-MM-DD" class="w-full" /></el-form-item>
        <el-form-item label="服务器到期提醒时间"><el-date-picker v-model="form.server_expire_date" type="date" value-format="YYYY-MM-DD" class="w-full" /></el-form-item>
      </div>

      <el-divider content-position="left">其他</el-divider>
      <el-form-item label="项目标签">
        <el-select v-model="form.tag_ids" multiple clearable class="w-full" placeholder="选择标签">
          <el-option v-for="t in tags" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="是否已结算">
        <el-switch v-model="form.settled" :active-value="1" :inactive-value="0" active-text="已结算" inactive-text="未结算" inline-prompt />
      </el-form-item>
      <el-form-item label="备注信息"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>

      <div class="flex gap-3 pt-2">
        <el-button type="primary" :loading="saving" @click="onSubmit">{{ isEdit ? '保存修改' : '创建项目' }}</el-button>
        <el-button @click="$router.back()">取消</el-button>
      </div>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import { api } from '@/api';
import { STATUS_LABEL, money, isHistoryProject, projectTypeValue } from '@/utils/constants';

const route = useRoute();
const router = useRouter();
const isEdit = computed(() => !!route.params.id);
const formRef = ref();
const uploadRef = ref();
const saving = ref(false);
const techs = ref([]);
const tags = ref([]);
const pendingFiles = ref([]);   // 待上传文件（el-upload 原始对象）
const existingFiles = ref([]);  // 已上传附件

const form = reactive({
  project_type: 1, name: '', description: '', requirement: '', duration: '',
  customer_name: '', customer_phone: '', group_name: '', tech_id: null,
  status: 'pending',
  start_time: null, actual_finish_time: null,
  total_reward: 0, first_payment: 0, mid_payment: 0, final_payment: 0,
  project_cost: 0, tech_fee: 0, maintenance_amount: 0, maintenance_expire_date: null,
  source_uploaded: null,
  server_first_push: '', server_owner: '', server_location: '', server_start_date: null, server_buy_date: null, server_expire_date: null,
  tag_ids: [], settled: 0, remark: ''
});

const rules = {
  name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入项目描述', trigger: 'blur' }],
  requirement: [{ required: true, message: '请输入项目要求', trigger: 'blur' }],
  duration: [{ required: true, message: '请输入项目工期', trigger: 'blur' }]
};

const income = computed(() => (Number(form.first_payment) || 0) + (Number(form.mid_payment) || 0) + (Number(form.final_payment) || 0));
const profit = computed(() => income.value - (Number(form.project_cost) || 0) - (Number(form.tech_fee) || 0));

function onTypeChange(v) {
  form.project_type = projectTypeValue(v);
  if (isHistoryProject(v)) {
    form.tech_id = null;
    form.status = 'completed';
  } else if (!form.status || form.status === 'completed') {
    form.status = 'pending';
  }
}

const MAX_SIZE = 200 * 1024 * 1024;
function onFileChange(file, fileList) {
  if (file.size > MAX_SIZE) {
    ElMessage.error(`${file.name} 超过 200MB 限制`);
    pendingFiles.value = fileList.filter((f) => f.uid !== file.uid);
    return;
  }
  pendingFiles.value = fileList;
}
function onFileRemove(file, fileList) {
  pendingFiles.value = fileList;
}

async function downloadFile(f) {
  await api.downloadFile(f.id, f.original_name);
}
async function removeExisting(f) {
  await ElMessageBox.confirm(`确认删除附件「${f.original_name}」？`, '提示', { type: 'warning' });
  await api.deleteFile(f.id);
  existingFiles.value = existingFiles.value.filter((x) => x.id !== f.id);
  ElMessage.success('已删除');
}

async function uploadPending(projectId) {
  if (!pendingFiles.value.length) return;
  const fd = new FormData();
  pendingFiles.value.forEach((f) => fd.append('files', f.raw));
  await api.uploadFiles(projectId, fd);
}

async function onSubmit() {
  await formRef.value.validate();
  saving.value = true;
  try {
    if (isEdit.value) {
      await api.updateProject(route.params.id, form);
      await uploadPending(route.params.id);
      ElMessage.success('保存成功');
    } else {
      const { id } = await api.createProject(form);
      await uploadPending(id);
      ElMessage.success('创建成功');
    }
    router.push('/projects');
  } catch (e) {
    /* 拦截器已提示 */
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  [techs.value, tags.value] = await Promise.all([api.techOptions(), api.listTags()]);
  if (isEdit.value) {
    const p = await api.getProject(route.params.id);
    Object.keys(form).forEach((k) => { if (p[k] !== undefined && p[k] !== null) form[k] = p[k]; });
    form.project_type = projectTypeValue(form.project_type);
    form.tag_ids = (p.tags || []).map((t) => t.id);
    existingFiles.value = p.files || [];
  }
});
</script>
