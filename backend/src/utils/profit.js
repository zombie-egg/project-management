/**
 * 项目利润自动计算
 * 公式：项目利润 =（首付款+中期款+尾款）- 项目成本金额 - 技术费用
 * 全项目通用（常规 + 旧完结维护项目），保留2位小数。
 */
function computeProfit(p) {
  const first = Number(p.first_payment) || 0;
  const mid = Number(p.mid_payment) || 0;
  const final = Number(p.final_payment) || 0;
  const cost = Number(p.project_cost) || 0;
  const techFee = Number(p.tech_fee) || 0;

  const income = first + mid + final;
  const profit = income - cost - techFee;
  return {
    income: round2(income),
    profit: round2(profit)
  };
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

module.exports = { computeProfit, round2 };
