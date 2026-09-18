import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InsuranceStatus, UserRole } from '../../constants/enums';
import { BusinessException } from '../../exceptions/business.exception';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InsuranceRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(user: { sub: string; role: UserRole }, petId?: string) {
    const where: Prisma.InsurancePolicyWhereInput = {
      ...(user.role === UserRole.PET_OWNER ? { pet: { ownerId: user.sub } } : {}),
      ...(petId ? { petId } : {}),
    };
    return this.prisma.insurancePolicy.findMany({
      where,
      include: { pet: true, claims: { select: { amount: true } } },
      orderBy: { endDate: 'asc' },
    });
  }

  findById(id: string) {
    return this.prisma.insurancePolicy.findUnique({ where: { id }, include: { pet: true } });
  }

  findClaimByRequestId(requestId: string) {
    return this.prisma.insuranceClaim.findUnique({ where: { requestId } });
  }

  create(data: Prisma.InsurancePolicyUncheckedCreateInput) {
    return this.prisma.insurancePolicy.create({ data });
  }

  update(id: string, data: Prisma.InsurancePolicyUncheckedUpdateInput) {
    return this.prisma.insurancePolicy.update({ where: { id }, data });
  }

  async submitClaim(policyId: string, requestId: string, amount: number) {
    const maxAttempts = 3;
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.submitClaimOnce(policyId, requestId, amount);
      } catch (error) {
        const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!retryable || attempt >= maxAttempts) throw error;
      }
    }
  }

  private submitClaimOnce(policyId: string, requestId: string, amount: number) {
    return this.prisma.$transaction(
      async (tx) => {
        const duplicated = await tx.insuranceClaim.findUnique({ where: { requestId } });
        if (duplicated) {
          if (duplicated.policyId !== policyId) throw new BusinessException('理赔请求单号已被其他保单占用');
          return this.buildClaimResult(tx, policyId, true);
        }
        const policy = await tx.insurancePolicy.findUnique({ where: { id: policyId } });
        if (!policy) throw new BusinessException('保单不存在', 40401);
        const claimed = await this.sumClaimed(tx, policyId);
        const remaining = Number(policy.coverage) - claimed;
        if (amount > remaining) {
          throw new BusinessException(`理赔金额超出保障额度，剩余可理赔额度 ¥${remaining.toFixed(2)}`, 40002, {
            remainingCoverage: remaining,
          });
        }
        await tx.insuranceClaim.create({ data: { policyId, requestId, amount } });
        if (policy.status === InsuranceStatus.ACTIVE) {
          await tx.insurancePolicy.update({ where: { id: policyId }, data: { status: InsuranceStatus.CLAIMING } });
        }
        return this.buildClaimResult(tx, policyId, false);
      },
      { isolationLevel: 'Serializable' },
    );
  }

  private async sumClaimed(tx: Prisma.TransactionClient, policyId: string) {
    const agg = await tx.insuranceClaim.aggregate({ where: { policyId }, _sum: { amount: true } });
    return Number(agg._sum.amount || 0);
  }

  private async buildClaimResult(tx: Prisma.TransactionClient, policyId: string, duplicated: boolean) {
    const policy = await tx.insurancePolicy.findUniqueOrThrow({ where: { id: policyId }, include: { pet: true } });
    const claimedAmount = await this.sumClaimed(tx, policyId);
    return {
      policy,
      claimedAmount,
      remainingCoverage: Number(policy.coverage) - claimedAmount,
      duplicated,
    };
  }
}
