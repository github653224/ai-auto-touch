/**
 * 流量列表组件
 * 显示抓包的 HTTP/HTTPS 请求，类似 mitmproxy web 界面
 */

import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Typography, Empty, Drawer, Tabs, Card } from 'antd';
import { ReloadOutlined, ClearOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import './TrafficList.css';

const { Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface TrafficFlow {
  id: string;
  timestamp: string | number;
  method: string;
  url: string;
  host: string;
  port: number;
  path: string;
  scheme: string;
  status: number | null;
  request_size: number;
  response_size: number | null;
  duration: number | null;
}

interface FlowDetail {
  id: string;
  request: {
    method: string;
    url: string;
    headers: Array<[string, string]>;
    content: string;
  };
  response?: {
    status_code: number;
    reason: string;
    headers: Array<[string, string]>;
    content: string;
  };
}

interface TrafficListProps {
  deviceId: string;
}

const TrafficList: React.FC<TrafficListProps> = ({ deviceId }) => {
  const [flows, setFlows] = useState<TrafficFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedFlow, setSelectedFlow] = useState<FlowDetail | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // 获取流量数据
  const fetchFlows = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/v1/mitmproxy/device/${deviceId}/flows?limit=100`);
      const data = await response.json();
      
      if (data.success) {
        setFlows(data.flows || []);
      }
    } catch (error) {
      console.error('获取流量数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取流量详情
  const fetchFlowDetail = async (flowId: string) => {
    try {
      setDetailLoading(true);
      const response = await fetch(`/api/v1/mitmproxy/device/${deviceId}/flow/${flowId}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedFlow(data.flow);
        setDrawerVisible(true);
      }
    } catch (error) {
      console.error('获取流量详情失败:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  // 清空流量记录
  const clearFlows = async () => {
    try {
      const response = await fetch(`/api/v1/mitmproxy/device/${deviceId}/clear`, {
        method: 'POST',
      });
      const data = await response.json();
      
      if (data.success) {
        setFlows([]);
      }
    } catch (error) {
      console.error('清空流量记录失败:', error);
    }
  };

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh) return;

    fetchFlows();
    const interval = setInterval(fetchFlows, 2000); // 每 2 秒刷新一次

    return () => clearInterval(interval);
  }, [deviceId, autoRefresh]);

  // 格式化文件大小
  const formatSize = (bytes: number | null): string => {
    if (bytes === null || bytes === 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  // 格式化时间
  const formatTime = (timestamp: string | number): string => {
    const date = typeof timestamp === 'number' 
      ? new Date(timestamp * 1000) 
      : new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour12: false });
  };

  // 获取状态码颜色
  const getStatusColor = (status: number | null): string => {
    if (status === null) return 'default';
    if (status >= 200 && status < 300) return 'success';
    if (status >= 300 && status < 400) return 'processing';
    if (status >= 400 && status < 500) return 'warning';
    if (status >= 500) return 'error';
    return 'default';
  };

  // 获取方法颜色
  const getMethodColor = (method: string): string => {
    const colors: Record<string, string> = {
      GET: 'blue',
      POST: 'green',
      PUT: 'orange',
      DELETE: 'red',
      PATCH: 'purple',
      HEAD: 'cyan',
      OPTIONS: 'default',
    };
    return colors[method] || 'default';
  };

  // 渲染请求头
  const renderHeaders = (headers: Array<[string, string]>) => {
    return (
      <div className="headers-container">
        {headers.map(([key, value], index) => (
          <div key={index} className="header-item">
            <Text strong>{key}:</Text> <Text>{value}</Text>
          </div>
        ))}
      </div>
    );
  };

  // 渲染内容
  const renderContent = (content: string) => {
    try {
      // 尝试格式化 JSON
      const json = JSON.parse(content);
      return (
        <pre className="content-pre">
          {JSON.stringify(json, null, 2)}
        </pre>
      );
    } catch {
      // 不是 JSON，直接显示
      return (
        <pre className="content-pre">
          {content || '(empty)'}
        </pre>
      );
    }
  };

  // 表格列定义
  const columns: ColumnsType<TrafficFlow> = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 100,
      render: (timestamp: string | number) => (
        <Text style={{ fontSize: 12 }}>{formatTime(timestamp)}</Text>
      ),
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method: string) => (
        <Tag color={getMethodColor(method)}>{method}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (status: number | null) => (
        status !== null ? (
          <Tag color={getStatusColor(status)}>{status}</Tag>
        ) : (
          <Tag color="default">-</Tag>
        )
      ),
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      ellipsis: true,
      render: (url: string) => (
        <Text
          style={{ fontSize: 12 }}
          ellipsis={{ tooltip: url }}
        >
          {url}
        </Text>
      ),
    },
    {
      title: '大小',
      key: 'size',
      width: 120,
      render: (_: any, record: TrafficFlow) => (
        <Text style={{ fontSize: 12 }}>
          {formatSize(record.request_size)} / {formatSize(record.response_size)}
        </Text>
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (duration: number | null) => (
        <Text style={{ fontSize: 12 }}>
          {duration !== null ? `${duration} ms` : '-'}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, record: TrafficFlow) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => fetchFlowDetail(record.id)}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div className="traffic-list-container">
      <div className="traffic-list-header">
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchFlows}
            loading={loading}
          >
            刷新
          </Button>
          <Button
            icon={<ClearOutlined />}
            onClick={clearFlows}
            danger
          >
            清空
          </Button>
          <Button
            type={autoRefresh ? 'primary' : 'default'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? '停止自动刷新' : '开启自动刷新'}
          </Button>
        </Space>
        <Text type="secondary" style={{ marginLeft: 16 }}>
          共 {flows.length} 条记录
        </Text>
      </div>
      
      <div className="traffic-list-content">
        {flows.length === 0 ? (
          <Empty
            description="暂无抓包数据"
            style={{ marginTop: 60 }}
          >
            <Text type="secondary">
              请在手机上访问网页，流量将自动显示在这里
            </Text>
          </Empty>
        ) : (
          <Table
            columns={columns}
            dataSource={flows}
            rowKey="id"
            size="small"
            pagination={{
              pageSize: 50,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
            }}
            loading={loading}
          />
        )}
      </div>

      {/* 详情抽屉 */}
      <Drawer
        title="流量详情"
        placement="right"
        width={720}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        loading={detailLoading}
      >
        {selectedFlow && (
          <Tabs defaultActiveKey="request">
            <TabPane tab="请求" key="request">
              <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
                <p><Text strong>方法:</Text> {selectedFlow.request.method}</p>
                <p><Text strong>URL:</Text> {selectedFlow.request.url}</p>
              </Card>
              
              <Card title="请求头" size="small" style={{ marginBottom: 16 }}>
                {renderHeaders(selectedFlow.request.headers)}
              </Card>
              
              <Card title="请求体" size="small">
                {renderContent(selectedFlow.request.content)}
              </Card>
            </TabPane>
            
            {selectedFlow.response && (
              <TabPane tab="响应" key="response">
                <Card title="基本信息" size="small" style={{ marginBottom: 16 }}>
                  <p>
                    <Text strong>状态码:</Text>{' '}
                    <Tag color={getStatusColor(selectedFlow.response.status_code)}>
                      {selectedFlow.response.status_code} {selectedFlow.response.reason}
                    </Tag>
                  </p>
                </Card>
                
                <Card title="响应头" size="small" style={{ marginBottom: 16 }}>
                  {renderHeaders(selectedFlow.response.headers)}
                </Card>
                
                <Card title="响应体" size="small">
                  {renderContent(selectedFlow.response.content)}
                </Card>
              </TabPane>
            )}
          </Tabs>
        )}
      </Drawer>
    </div>
  );
};

export default TrafficList;
