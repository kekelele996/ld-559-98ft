import { Injectable } from '@nestjs/common';
import { InsuranceStatus, UserRole } from '../../constants/enums';
import { BusinessException } from '../../exceptions/business.exception';
import { ClaimInsuranceDto, CreateInsuranceDto, UpdateInsuranceDto } from './insurance.dto';
import { InsuranceRepository } from './insurance.repository';
import { validateClaimableStatus, validatePolicyDates } from './insurance.validator';

@Injectable()
export class InsuranceService {
  constructor(private readonly repo: InsuranceRepository) {}

  async list(user: { sub: string; role: UserRole }, petId?: string) {
    const policies = await this.repo.findMany(user, petId);
    return policies.map(({ claims, ...policy }) => {
      const claimedAmount = claims.reduce((sum, claim) => sum + Number(claim.amount), 0);
      return {
        ...policy,
        claimedAmount,
        remainingCoverage: Number(policy.coverage) - claimedAmount,
      };
    });
  }

  create(dto: CreateInsuranceDto) {
    validatePolicyDates(dto.startDate, dto.endDate);
    return this.repo.create({ ...dto, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) });
  }

  async claim(id: string, dto: ClaimInsuranceDto) {
    const policy = await this.repo.findById(id);
    if (!policy) throw new BusinessException('保单不存在', 40401);
    validateClaimableStatus(policy.status as InsuranceStatus);
    const existing = await this.repo.findClaimByRequestId(dto.requestId);
    if (existing && existing.policyId !== id) throw new BusinessException('理赔请求单号已被其他保单占用');
    return this.repo.submitClaim(id, dto.requestId, dto.amount);
  }

  update(id: string, dto: UpdateInsuranceDto) {
    validatePolicyDates(dto.startDate, dto.endDate);
    return this.repo.update(id, { ...dto, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) });
  }
}
