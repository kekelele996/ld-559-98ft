import { BusinessException } from '../../exceptions/business.exception';
import { InsuranceStatus } from '../../constants/enums';

export function validatePolicyDates(startDate: string, endDate: string) {
  if (new Date(endDate) <= new Date(startDate)) throw new BusinessException('保单结束日期必须晚于开始日期');
}

export function validateClaimableStatus(status: InsuranceStatus) {
  if (status === InsuranceStatus.EXPIRED) throw new BusinessException('保单已过期，无法提交理赔');
  if (status !== InsuranceStatus.ACTIVE && status !== InsuranceStatus.CLAIMING) {
    throw new BusinessException('当前保单状态不支持提交理赔');
  }
}

export function validateClaimWithinCoverage(amount: number, remaining: number) {
  if (amount > remaining) {
    throw new BusinessException(
      `理赔金额超出保障额度，剩余可理赔额度为 ¥${remaining.toLocaleString('zh-CN')}`,
      40002,
      { remainingAmount: remaining },
    );
  }
}
