import { InsuranceStatus, PolicyType } from '../constants/enums';
import { Pet } from './pet';

export interface InsurancePolicy {
  id: string;
  petId: string;
  provider: string;
  planType: PolicyType;
  premium: number;
  coverage: number;
  startDate: string;
  endDate: string;
  status: InsuranceStatus;
  claimedAmount?: number;
  remainingAmount?: number;
  pet?: Pet;
}

export interface ClaimPayload {
  amount: number;
  requestId: string;
}

export interface ClaimResult {
  id: string;
  status: InsuranceStatus;
  claimedAmount: number;
  remainingAmount: number;
  duplicated: boolean;
}
