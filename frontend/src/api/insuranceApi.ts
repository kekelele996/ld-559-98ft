import { request, unwrap } from '../utils/request';
import type { ApiResponse } from '../utils/request';
import type { ClaimPayload, ClaimResult, InsurancePolicy } from '../types/insurance';
import { mockInsurance } from '../utils/mockData';

export const insuranceApi = {
  list: (params?: { petId?: string }) => unwrap<InsurancePolicy[]>(request.get('/insurance', { params }), mockInsurance),
  claim: (id: string, payload: ClaimPayload) => request.patch<ApiResponse<ClaimResult>>(`/insurance/${id}/claim`, payload),
};
