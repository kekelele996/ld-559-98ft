import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InsuranceStatus, UserRole } from '../../constants/enums';
import { BusinessException } from '../../exceptions/business.exception';
import { CreateInsuranceDto, SubmitClaimDto, UpdateInsuranceDto } from './insurance.dto';
import { InsuranceRepository } from './insurance.repository';
import { validateClaimableStatus, validateClaimWithinCoverage, validatePolicyDates } from './insurance.validator';

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
        remainingAmount: Math.max(Number(policy.coverage) - claimedAmount, 0),
      };
    });
  }

  create(dto: CreateInsuranceDto) {
    validatePolicyDates(dto.startDate, dto.endDate);
    return this.repo.create({ ...dto, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) });
  }

  async claim(id: string, dto: SubmitClaimDto) {
    const policy = await this.repo.findById(id);
    if (!policy) throw new BusinessException('保单不存在', 40404);
    validateClaimableStatus(policy.status as InsuranceStatus);

    // 幂等：同一 requestId 的重复提交只算一次，不重复占额
    const existing = await this.repo.findClaimByRequestId(id, dto.requestId);
    if (existing) return this.claimSnapshot(id, policy.status as InsuranceStatus, true);

    const claimedBefore = await this.repo.sumClaims(id);
    const remaining = Number(policy.coverage) - claimedBefore;
    validateClaimWithinCoverage(dto.amount, remaining);

    try {
      await this.repo.createClaimAndMarkClaiming(id, dto);
    } catch (error) {
      // 并发重复提交触发 requestId 唯一约束时按已受理处理
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.claimSnapshot(id, InsuranceStatus.CLAIMING, true);
      }
      throw error;
    }
    return this.claimSnapshot(id, InsuranceStatus.CLAIMING, false);
  }

  update(id: string, dto: UpdateInsuranceDto) {
    validatePolicyDates(dto.startDate, dto.endDate);
    return this.repo.update(id, { ...dto, startDate: new Date(dto.startDate), endDate: new Date(dto.endDate) });
  }

  private async claimSnapshot(policyId: string, status: InsuranceStatus, duplicated: boolean) {
    const claimedAmount = await this.repo.sumClaims(policyId);
    const policy = await this.repo.findById(policyId);
    const coverage = Number(policy?.coverage || 0);
    return {
      id: policyId,
      status,
      claimedAmount,
      remainingAmount: Math.max(coverage - claimedAmount, 0),
      duplicated,
    };
  }
}
