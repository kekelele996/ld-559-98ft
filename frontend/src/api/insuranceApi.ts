import { request, unwrap } from '../utils/request';
import type { ClaimPayload, InsurancePolicy } from '../types/insurance';
import { mockInsurance } from '../utils/mockData';

export const insuranceApi = {
  list: (params?: { petId?: string }) => unwrap<InsurancePolicy[]>(request.get('/insurance', { params }), mockInsurance),
  claim: (id: string, payload: ClaimPayload) => request.patch(`/insurance/${id}/claim`, payload),
};
