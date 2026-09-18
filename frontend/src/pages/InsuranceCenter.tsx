import { useState } from 'react';
import { Button, Card, Col, InputNumber, Modal, Row, Space, Steps, Typography, message } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { insuranceApi } from '../api/insuranceApi';
import { InsurancePieChart } from '../components/charts/InsurancePieChart';
import { StatusBadge } from '../components/common/StatusBadge';
import { InsuranceStatus, enumLabels } from '../constants/enums';
import type { InsurancePolicy } from '../types/insurance';
import { formatCurrency, formatDate } from '../utils/format';

const CLAIMABLE_STATUS: InsuranceStatus[] = [InsuranceStatus.ACTIVE, InsuranceStatus.CLAIMING];

const newRequestId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const remainingOf = (policy: InsurancePolicy) =>
  policy.remainingCoverage ?? Number(policy.coverage) - Number(policy.claimedAmount || 0);

export default function InsuranceCenter() {
  const client = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ['insurance'], queryFn: () => insuranceApi.list() });
  const [claimTarget, setClaimTarget] = useState<InsurancePolicy | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [requestId, setRequestId] = useState('');

  const claim = useMutation({
    mutationFn: () => insuranceApi.claim(claimTarget!.id, { amount: amount!, requestId }),
    onSuccess: () => {
      message.success('理赔提交成功，已受理');
      setClaimTarget(null);
      client.invalidateQueries({ queryKey: ['insurance'] });
    },
  });

  const openClaim = (policy: InsurancePolicy) => {
    setClaimTarget(policy);
    setAmount(null);
    setRequestId(newRequestId());
  };

  return (
    <Space direction="vertical" size={20} className="page-block">
      <Typography.Title level={2}>保险中心</Typography.Title>
      <Row gutter={[16, 16]}>
        {data.map((policy) => (
          <Col xs={24} lg={12} key={policy.id}>
            <Card
              actions={[
                <Button
                  key="claim"
                  type="link"
                  disabled={!CLAIMABLE_STATUS.includes(policy.status)}
                  onClick={() => openClaim(policy)}
                >
                  提交理赔
                </Button>,
              ]}
            >
              <Space direction="vertical">
                <Space><Typography.Title level={4}>{policy.provider}</Typography.Title><StatusBadge status={policy.status} /></Space>
                <Typography.Text>{policy.pet?.name} · {enumLabels[policy.planType]}计划</Typography.Text>
                <Typography.Text>保费 {formatCurrency(policy.premium)}，保障 {formatCurrency(policy.coverage)}</Typography.Text>
                <Typography.Text type={remainingOf(policy) > 0 ? 'success' : 'danger'}>
                  剩余可理赔额度 {formatCurrency(remainingOf(policy))}
                  {Number(policy.claimedAmount) > 0 ? `（已受理 ${formatCurrency(Number(policy.claimedAmount))}）` : ''}
                </Typography.Text>
                <Typography.Text type="secondary">{formatDate(policy.startDate)} 至 {formatDate(policy.endDate)}</Typography.Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}><Card title="理赔进度"><Steps current={1} items={[{ title: '提交' }, { title: '审核' }, { title: '赔付' }]} /></Card></Col>
        <Col xs={24} lg={12}><Card title="年度保费分析"><InsurancePieChart policies={data} /></Card></Col>
      </Row>
      <Modal
        title={`提交理赔 - ${claimTarget?.provider || ''}`}
        open={!!claimTarget}
        onCancel={() => setClaimTarget(null)}
        onOk={() => claim.mutate()}
        okText="提交理赔"
        cancelText="取消"
        confirmLoading={claim.isPending}
        okButtonProps={{ disabled: !amount || amount <= 0 }}
      >
        <Space direction="vertical" size={12} className="page-block">
          <Typography.Text>
            保障额度 {formatCurrency(Number(claimTarget?.coverage || 0))}，剩余可理赔额度{' '}
            <Typography.Text strong type="success">{formatCurrency(claimTarget ? remainingOf(claimTarget) : 0)}</Typography.Text>
          </Typography.Text>
          <InputNumber
            style={{ width: '100%' }}
            placeholder="请输入本次理赔金额"
            min={0.01}
            max={claimTarget ? remainingOf(claimTarget) : undefined}
            precision={2}
            value={amount}
            onChange={(value) => setAmount(value)}
            prefix="¥"
          />
        </Space>
      </Modal>
    </Space>
  );
}
