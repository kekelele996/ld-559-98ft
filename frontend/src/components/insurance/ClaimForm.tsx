import { useState } from 'react';
import { InputNumber, Modal, Typography, message } from 'antd';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { insuranceApi } from '../../api/insuranceApi';
import type { InsurancePolicy } from '../../types/insurance';
import { formatCurrency } from '../../utils/format';

export interface ClaimTarget {
  policy: InsurancePolicy;
  requestId: string;
}

interface ClaimFormProps {
  target: ClaimTarget | null;
  onClose: () => void;
}

export function ClaimForm({ target, onClose }: ClaimFormProps) {
  const [amount, setAmount] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => insuranceApi.claim(target!.policy.id, { amount: amount!, requestId: target!.requestId }),
    onSuccess: () => {
      message.success('理赔提交成功');
      queryClient.invalidateQueries({ queryKey: ['insurance'] });
      handleClose();
    },
  });

  const handleClose = () => {
    setAmount(null);
    onClose();
  };

  const remaining = target
    ? target.policy.remainingAmount ?? target.policy.coverage - (target.policy.claimedAmount ?? 0)
    : 0;

  return (
    <Modal
      open={Boolean(target)}
      title={`提交理赔 - ${target?.policy.provider ?? ''}`}
      okText="提交理赔"
      cancelText="取消"
      confirmLoading={mutation.isPending}
      okButtonProps={{ disabled: !amount || amount <= 0 }}
      onOk={() => mutation.mutate()}
      onCancel={handleClose}
      destroyOnHidden
    >
      <Typography.Paragraph>
        保障额度 {formatCurrency(target?.policy.coverage ?? 0)}，剩余可理赔额度 {formatCurrency(remaining)}
      </Typography.Paragraph>
      <Typography.Text>本次理赔金额</Typography.Text>
      <InputNumber
        style={{ width: '100%', marginTop: 8 }}
        min={0.01}
        precision={2}
        value={amount}
        onChange={(value) => setAmount(value)}
        placeholder="请输入本次理赔金额"
        prefix="¥"
      />
    </Modal>
  );
}
