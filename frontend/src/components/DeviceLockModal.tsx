/**
 * 设备锁定提示弹窗
 * 当设备被其他用户占用时显示
 */

import React from 'react';
import { Modal, Button, Space, Typography, Descriptions } from 'antd';
import { LockOutlined, UserOutlined, ClockCircleOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface LockInfo {
  session_id: string;
  user_id: string;
  user_name: string;
  locked_at: string;
  last_heartbeat: string;
  locked_duration: number;
}

interface DeviceLockModalProps {
  visible: boolean;
  deviceId: string;
  lockInfo: LockInfo | null;
  onCancel: () => void;
  onForceAcquire: () => void;
  showForceButton?: boolean;
}

const DeviceLockModal: React.FC<DeviceLockModalProps> = ({
  visible,
  deviceId,
  lockInfo,
  onCancel,
  onForceAcquire,
  showForceButton = false,
}) => {
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} 秒`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} 分钟`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} 小时 ${minutes} 分钟`;
    }
  };

  return (
    <Modal
      open={visible}
      title={
        <Space>
          <LockOutlined style={{ color: '#faad14' }} />
          <span>设备正在使用中</span>
        </Space>
      }
      onCancel={onCancel}
      footer={
        <Space>
          <Button onClick={onCancel}>返回</Button>
          {showForceButton && (
            <Button type="primary" danger onClick={onForceAcquire}>
              强制获取（管理员）
            </Button>
          )}
        </Space>
      }
      width={500}
    >
      <div style={{ padding: '20px 0' }}>
        <Title level={5} style={{ marginBottom: 16 }}>
          设备 {deviceId} 正在被其他用户使用
        </Title>

        {lockInfo && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item
              label={
                <Space>
                  <UserOutlined />
                  <span>当前用户</span>
                </Space>
              }
            >
              <Text strong>{lockInfo.user_name}</Text>
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <Space>
                  <ClockCircleOutlined />
                  <span>使用时长</span>
                </Space>
              }
            >
              {formatDuration(lockInfo.locked_duration)}
            </Descriptions.Item>
            <Descriptions.Item label="开始时间">
              {new Date(lockInfo.locked_at).toLocaleString('zh-CN')}
            </Descriptions.Item>
            <Descriptions.Item label="最后活跃">
              {new Date(lockInfo.last_heartbeat).toLocaleString('zh-CN')}
            </Descriptions.Item>
          </Descriptions>
        )}

        <div style={{ marginTop: 20, padding: 12, background: '#f0f0f0', borderRadius: 4 }}>
          <Text type="secondary">
            💡 提示：请等待当前用户使用完毕后再试，或联系管理员强制释放设备锁。
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default DeviceLockModal;
