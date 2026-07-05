<template>
  <div v-loading="loading" class="max-w-5xl mx-auto">
    <div v-if="p" class="flex items-center justify-between mb-6">
      <div>
        <div class="flex items-center gap-3">
          <h2 class="page-title">{{ p.name }}</h2>
          <el-tag :type="isHistoryProject(p.project_type)?'info':'primary'" effect="light">{{ p.type_label }}</el-tag>
          <el-tag :type="statusType">{{ p.status_label }}</el-tag>
        </div>
        <p class="page-sub">项目编号 #{{ p.id }} · 创建于 {{ p.created_at }}</p>
      </div>
      <div class="flex gap-3">
        <el-button v-if="canAdminComplete" type="success" @click="markCompleted">标记已完工</el-button>
        <el-button v-if="isAdmin" type="primary" @click="$router.push(`/projects/${p.id}/edit`)">编辑</el-button>
        <el-button @click="$router.back()">返回</el-button>
      </div>
    </div>

    <template v-if="p">
      <!-- 进度流转（仅常规项目）-->
      <div v-if="!isHistoryProject(p.project_type)" class="apple-card mb-4">
        <div class="font-medium mb-5">项目进度</div>
        <el-steps :active="activeStep" finish-status="success" align-center>
          <el-step v-for="s in TECH_STEPS" :key="s.key" :title="s.label" />
        </el-steps>

        <!-- 技术员操作区 -->
        <div v-if="canOperate" class="mt-6 border-t border-apple-line pt-5">
          <template v-if="p.locked">
            <el-alert type="success" :closable="false" show-icon>
              已提交付款申请，项目锁定。源码是否上传：<b>{{ p.source_uploaded ? '是' : '否' }}</b>（申请时间：{{ p.payment_request_time }}）
            </el-alert>
          </template>
          <template v-else>
            <div class="flex items-start gap-4 flex-wrap">
              <el-input v-model="note" type="textarea" :rows="2" placeholder="阶段性工作备注（同步给管理员）" class="flex-1 min-w-[280px]" />
              <div class="flex flex-col gap-2">
                <!-- 到 stage5 时需勾选源码 -->
                <template v-if="nextStatus==='stage5'">
                  <el-radio-group v-model="sourceUploaded">
                    <el-radio :value="1">源码已上传</el-radio>
                    <el-radio :value="0">源码未上传</el-radio>
                  </el-radio-group>
                  <div class="text-xs text-apple-gray max-w-xs">源码文件请私发给管理员，系统不存储源码文件，仅记录勾选状态；提交付款申请后项目锁定。</div>
                </template>
                <el-button v-if="nextStatus" type="primary" @click="advance">
                  流转到「{{ STATUS_LABEL[nextStatus] }}」
                </el-button>
                <el-tag v-else type="success">项目已完成全部流转</el-tag>
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 付款申请记录（管理员可见）-->
      <div v-if="isAdmin && p.payment_requested" class="apple-card mb-4">
        <el-alert type="warning" :closable="false" show-icon>
          <template #title>
            技术员已提交付款申请 · 源码是否上传：<b>{{ p.source_uploaded ? '是' : '否' }}</b> · 时间：{{ p.payment_request_time }}
          </template>
        </el-alert>
      </div>

      <!-- 技术费结算（管理员可见）-->
      <div v-if="isAdmin && !isHistoryProject(p.project_type)" class="apple-card mb-4">
        <div class="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div class="font-medium mb-2">技术费结算</div>
            <div class="text-sm text-apple-gray">
              技术费用 {{ money(p.tech_fee) }} · 已结算 {{ money(p.tech_fee_paid) }} · 剩余未结算
              <span :style="{ color: p.tech_fee_unpaid > 0 ? '#ff375f' : '#34c759' }">{{ money(p.tech_fee_unpaid) }}</span>
            </div>
          </div>
          <el-button type="primary" :disabled="!p.tech_fee_unpaid" @click="openSettlement">部分结算</el-button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 基础信息 -->
        <div class="apple-card">
          <div class="font-medium mb-4">基础信息</div>
          <InfoRow label="项目描述" :value="p.description" />
          <InfoRow label="项目要求" :value="p.requirement" />
          <InfoRow label="项目工期" :value="p.duration" />
          <InfoRow label="项目群名" :value="p.group_name" />
          <InfoRow label="客户姓名" :value="p.customer_name" />
          <InfoRow label="客户联系方式" :value="p.customer_phone" />
          <InfoRow label="分配技术员" :value="p.tech_name || '未分配'" />
          <InfoRow label="项目开始时间" :value="p.start_time" />
          <InfoRow label="实际完工时间" :value="p.actual_finish_time" />
        </div>

        <!-- 资金信息 -->
        <div class="apple-card">
          <div class="font-medium mb-4">资金信息</div>
          <InfoRow label="开发总酬劳" :value="money(p.total_reward)" />
          <InfoRow label="首付款" :value="money(p.first_payment)" />
          <InfoRow label="中期款" :value="money(p.mid_payment)" />
          <InfoRow label="尾款" :value="money(p.final_payment)" />
          <InfoRow label="项目成本" :value="money(p.project_cost)" />
          <InfoRow label="技术费用" :value="money(p.tech_fee)" />
          <InfoRow label="技术费已结算" :value="money(p.tech_fee_paid)" />
          <InfoRow label="技术费剩余未结算" :value="money(p.tech_fee_unpaid)" />
          <InfoRow label="维护金额" :value="money(p.maintenance_amount)" />
          <InfoRow label="维护费到期" :value="p.maintenance_expire_date" />
          <InfoRow label="源码是否提交" :value="p.source_uploaded === null || p.source_uploaded === undefined ? '未填写' : (p.source_uploaded ? '是' : '否')" />
          <div class="flex justify-between py-2 border-t border-apple-line mt-2">
            <span class="text-apple-gray">合计收入 / 利润</span>
            <span><b class="text-apple-blue">{{ money(p.income) }}</b> / <b style="color:#34c759">{{ money(p.profit) }}</b></span>
          </div>
        </div>

        <!-- 服务器信息 -->
        <div class="apple-card">
          <div class="font-medium mb-4">服务器信息</div>
          <InfoRow label="是否首推" :value="p.server_first_push" />
          <InfoRow label="终推归属" :value="p.server_owner" />
          <InfoRow label="服务器位置" :value="p.server_location" />
          <InfoRow label="开始日期" :value="p.server_start_date" />
          <InfoRow label="购买时间" :value="p.server_buy_date" />
          <InfoRow label="到期提醒" :value="p.server_expire_date" />
        </div>

        <!-- 附件 -->
        <div class="apple-card">
          <div class="flex items-center justify-between mb-4">
            <span class="font-medium">项目附件（{{ p.files?.length || 0 }}）</span>
            <el-button v-if="p.files?.length" link type="primary" size="small" @click="downloadAll">一键下载全部</el-button>
          </div>
          <div v-if="p.files?.length">
            <div v-for="f in p.files" :key="f.id" class="flex items-center justify-between py-2 border-b border-apple-line last:border-0">
              <span class="text-sm truncate">{{ f.original_name }} <span class="text-apple-gray">({{ (f.size/1024/1024).toFixed(2) }}MB)</span></span>
              <el-button link type="primary" size="small" @click="download(f)">下载</el-button>
            </div>
          </div>
          <el-empty v-else description="暂无附件" :image-size="60" />
        </div>
      </div>

      <!-- 备注 & 进度记录 -->
      <div class="apple-card mt-4">
        <div class="font-medium mb-3">备注信息</div>
        <p class="text-sm text-apple-gray">{{ p.remark || '无' }}</p>
      </div>

      <div v-if="p.progress?.length" class="apple-card mt-4">
        <div class="font-medium mb-4">进度流转记录</div>
        <el-timeline>
          <el-timeline-item v-for="pg in p.progress" :key="pg.id" :timestamp="pg.created_at" placement="top">
            <div>{{ STATUS_LABEL[pg.from_status] || pg.from_status }} → <b>{{ STATUS_LABEL[pg.to_status] }}</b> <span class="text-apple-gray text-sm">by {{ pg.operator_name }}</span></div>
            <div v-if="pg.note" class="text-sm text-apple-gray mt-1">备注：{{ pg.note }}</div>
          </el-timeline-item>
        </el-timeline>
      </div>
    </template>

    <el-dialog v-model="settlementDialog" title="技术费部分结算" width="460px">
      <el-form :model="settlementForm" label-width="100px">
        <el-form-item label="剩余未结算"><span class="font-medium">{{ money(p?.tech_fee_unpaid) }}</span></el-form-item>
        <el-form-item label="本次结算">
          <el-input-number v-model="settlementForm.amount" :min="0" :max="p?.tech_fee_unpaid || 0" :precision="2" class="w-full" controls-position="right" />
        </el-form-item>
        <el-form-item label="结算日期"><el-date-picker v-model="settlementForm.received_at" type="date" value-format="YYYY-MM-DD" class="w-full" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="settlementForm.remark" placeholder="如 技术费部分结算" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="settlementDialog=false">取消</el-button>
        <el-button type="primary" @click="submitSettlement">确认结算</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, h } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { api } from '@/api';
import { useUserStore } from '@/store/user';
import { STATUS_LABEL, STATUS_TAG_TYPE, STATUS_FLOW, TECH_STEPS, money, isHistoryProject } from '@/utils/constants';

// 简单信息行组件
const InfoRow = (props) => h('div', { class: 'flex justify-between py-2 border-b border-apple-line last:border-0' }, [
  h('span', { class: 'text-apple-gray whitespace-nowrap mr-4' }, props.label),
  h('span', { class: 'text-right break-all' }, props.value || '—')
]);
InfoRow.props = ['label', 'value'];

const route = useRoute();
const store = useUserStore();
const isAdmin = computed(() => store.isAdmin);
const loading = ref(false);
const p = ref(null);
const note = ref('');
const sourceUploaded = ref(1);
const settlementDialog = ref(false);
const settlementForm = reactive({ amount: 0, received_at: '', remark: '' });

const statusType = computed(() => STATUS_TAG_TYPE[p.value?.status] || '');
const activeStep = computed(() => {
  if (!p.value) return 0;
  const idx = STATUS_FLOW.indexOf(p.value.status);
  // TECH_STEPS 从 stage1 开始（STATUS_FLOW 索引1）
  if (p.value.status === 'pending') return 0;
  if (p.value.status === 'completed') return TECH_STEPS.length;
  return idx; // stage1->1 ... stage5->5
});
const nextStatus = computed(() => {
  if (!p.value) return null;
  const idx = STATUS_FLOW.indexOf(p.value.status);
  return STATUS_FLOW[idx + 1] || null;
});
const canOperate = computed(() =>
  p.value && !isHistoryProject(p.value.project_type) &&
  (store.isTech && p.value.tech_id === store.user.id)
);
const canAdminComplete = computed(() =>
  p.value && store.isAdmin && !isHistoryProject(p.value.project_type) && p.value.status !== 'completed'
);

async function load() {
  loading.value = true;
  try { p.value = await api.getProject(route.params.id); }
  finally { loading.value = false; }
}

async function advance() {
  const payload = { to_status: nextStatus.value, note: note.value };
  if (nextStatus.value === 'stage5') payload.source_uploaded = sourceUploaded.value;
  await api.progressProject(p.value.id, payload);
  ElMessage.success('流转成功');
  note.value = '';
  load();
}

async function markCompleted() {
  await api.updateProject(p.value.id, { status: 'completed' });
  ElMessage.success('已标记为已完工');
  load();
}

function openSettlement() {
  Object.assign(settlementForm, {
    amount: p.value?.tech_fee_unpaid || 0,
    received_at: new Date().toISOString().slice(0, 10),
    remark: '技术费部分结算'
  });
  settlementDialog.value = true;
}

async function submitSettlement() {
  if (!settlementForm.amount || settlementForm.amount <= 0) return ElMessage.warning('请输入本次结算金额');
  await api.settleTechFee(p.value.id, settlementForm);
  ElMessage.success('结算成功');
  settlementDialog.value = false;
  load();
}

async function download(f) { await api.downloadFile(f.id, f.original_name); }
async function downloadAll() {
  for (const f of p.value.files) {
    await api.downloadFile(f.id, f.original_name);
  }
}

onMounted(load);
</script>
