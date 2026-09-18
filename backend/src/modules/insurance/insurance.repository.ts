import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InsuranceStatus, UserRole } from '../../constants/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitClaimDto } from './insurance.dto';

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
    return this.prisma.insurancePolicy.findUnique({ where: { id } });
  }

  findClaimByRequestId(policyId: string, requestId: string) {
    return this.prisma.insuranceClaim.findFirst({ where: { policyId, requestId } });
  }

  async sumClaims(policyId: string): Promise<number> {
    const agg = await this.prisma.insuranceClaim.aggregate({
      where: { policyId },
      _sum: { amount: true },
    });
    return Number(agg._sum.amount || 0);
  }

  createClaimAndMarkClaiming(policyId: string, dto: SubmitClaimDto) {
    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.insuranceClaim.create({
        data: { policyId, amount: dto.amount, requestId: dto.requestId },
      });
      await tx.insurancePolicy.update({
        where: { id: policyId },
        data: { status: InsuranceStatus.CLAIMING },
      });
      return claim;
    });
  }

  create(data: Prisma.InsurancePolicyUncheckedCreateInput) {
    return this.prisma.insurancePolicy.create({ data });
  }

  update(id: string, data: Prisma.InsurancePolicyUncheckedUpdateInput) {
    return this.prisma.insurancePolicy.update({ where: { id }, data });
  }
}
