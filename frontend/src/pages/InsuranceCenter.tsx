import { useState } from 'react';
import { Button, Card, Col, Row, Space, Steps, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { insuranceApi } from '../api/insuranceApi';
import { ClaimForm, ClaimTarget } from '../components/insurance/ClaimForm';
import { InsurancePieChart } from '../components/charts/InsurancePieChart';
import { StatusBadge } from '../components/common/StatusBadge';
import { enumLabels } from '../constants/enums';
import { formatCurrency, formatDate } from '../utils/format';

const newRequestId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `claim-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function InsuranceCenter() {
  const { data = [] } = useQuery({ queryKey: ['insurance'], queryFn: () => insuranceApi.list() });
  const [claimTarget, setClaimTarget] = useState<ClaimTarget | null>(null);

  return (
    <Space direction="vertical" size={20} className="page-block">
      <Typography.Title level={2}>保险中心</Typography.Title>
      <Row gutter={[16, 16]}>
        {data.map((policy) => {
          const remaining = policy.remainingAmount ?? policy.coverage - (policy.claimedAmount ?? 0);
          return (
            <Col xs={24} lg={12} key={policy.id}>
              <Card
                actions={[
                  <Button
                    key="claim"
                    type="link"
                    onClick={() => setClaimTarget({ policy, requestId: newRequestId() })}
                  >
                    提交理赔
                  </Button>,
                ]}
              >
                <Space direction="vertical">
                  <Space><Typography.Title level={4}>{policy.provider}</Typography.Title><StatusBadge status={policy.status} /></Space>
                  <Typography.Text>{policy.pet?.name} · {enumLabels[policy.planType]}计划</Typography.Text>
                  <Typography.Text>保费 {formatCurrency(policy.premium)}，保障 {formatCurrency(policy.coverage)}</Typography.Text>
                  <Typography.Text type="success">剩余可理赔额度 {formatCurrency(remaining)}</Typography.Text>
                  <Typography.Text type="secondary">{formatDate(policy.startDate)} 至 {formatDate(policy.endDate)}</Typography.Text>
                </Space>
              </Card>
            </Col>
          );
        })}
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}><Card title="理赔进度"><Steps current={1} items={[{ title: '提交' }, { title: '审核' }, { title: '赔付' }]} /></Card></Col>
        <Col xs={24} lg={12}><Card title="年度保费分析"><InsurancePieChart policies={data} /></Card></Col>
      </Row>
      <ClaimForm target={claimTarget} onClose={() => setClaimTarget(null)} />
    </Space>
  );
}
