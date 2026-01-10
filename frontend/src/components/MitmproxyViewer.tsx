/**
 * Mitmproxy 抓包查看器
 * 显示自定义流量列表 + mitmweb 按钮
 */

import React, { useEffect, useState } from 'react';
import { Spin, Alert, Button } from 'antd';
import { ReloadOutlined, GlobalOutlined } from '@ant-design/icons';
import { startMitmweb, getMitmwebStatus } from '../api/mitmproxyApi';
import TrafficList from './TrafficList';
import './MitmproxyViewer.css';

interface MitmproxyViewerProps {
  deviceId: string;
}

type ViewerStatus = 'loading' | 'starting' | 'online' | 'error';

const MitmproxyViewer: React.FC<MitmproxyViewerProps> = ({ deviceId }) => {
  const [status, setStatus] = useState<ViewerStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [proxyInfo, setProxyInfo] = useState<{ host: string; port: number; webPort: number } | null>(null);

  useEffect(() => {
    initMitmweb();
  }, [deviceId]);

  const initMitmweb = async () => {
    try {
      setStatus('loading');
      setErrorMessage('');

      // 1. 检查 mitmweb 状态
      const statusData = await getMitmwebStatus(deviceId);

      if (statusData.status === 'online') {
        // 已经在运行
        const host = statusData.proxy_host || window.location.hostname;
        const webPort = statusData.web_port || 8191;
        console.log('mitmweb 状态:', statusData);
        console.log('使用 web 端口:', webPort);
        setProxyInfo({
          host: host,
          port: statusData.proxy_port || 0,
          webPort: webPort,
        });
        setStatus('online');
      } else {
        // 需要启动
        setStatus('starting');
        const startResult = await startMitmweb(deviceId);

        if (startResult.success) {
          const host = startResult.proxy_host || window.location.hostname;
          const webPort = startResult.web_port || 8191;
          console.log('mitmweb 启动结果:', startResult);
          console.log('使用 web 端口:', webPort);
          setProxyInfo({
            host: host,
            port: startResult.proxy_port || 0,
            webPort: webPort,
          });
          setStatus('online');
        } else {
          throw new Error(startResult.message);
        }
      }
    } catch (error) {
      console.error('初始化 mitmweb 失败:', error);
      setErrorMessage(error instanceof Error ? error.message : '未知错误');
      setStatus('error');
    }
  };

  const handleRetry = () => {
    initMitmweb();
  };

  const handleOpenMitmweb = () => {
    if (proxyInfo) {
      const url = `http://localhost:${proxyInfo.webPort}`;
      console.log('打开 mitmweb 界面:', url);
      console.log('当前 proxyInfo:', proxyInfo);
      window.open(url, '_blank');
    }
  };

  if (status === 'loading') {
    return (
      <div className="mitmproxy-viewer-container">
        <div className="mitmproxy-viewer-loading">
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>正在检查抓包服务状态...</p>
        </div>
      </div>
    );
  }

  if (status === 'starting') {
    return (
      <div className="mitmproxy-viewer-container">
        <div className="mitmproxy-viewer-loading">
          <Spin size="large" />
          <p style={{ marginTop: 16 }}>正在启动抓包服务...</p>
          <p style={{ color: '#666', fontSize: 12 }}>首次启动可能需要几秒钟</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mitmproxy-viewer-container">
        <div className="mitmproxy-viewer-error">
          <Alert
            message="抓包服务启动失败"
            description={errorMessage}
            type="error"
            showIcon
          />
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleRetry}
            style={{ marginTop: 16 }}
          >
            重试
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mitmproxy-viewer-container">
      {proxyInfo && (
        <div className="mitmproxy-viewer-header">
          <div className="proxy-info">
            <span className="proxy-label">代理地址:</span>
            <span className="proxy-value">
              {proxyInfo.host}:{proxyInfo.port}
            </span>
            <span className="proxy-hint">
              (在手机 WiFi 设置中配置此代理)
            </span>
          </div>
          <Button 
            icon={<GlobalOutlined />}
            onClick={handleOpenMitmweb}
            style={{ marginLeft: 'auto' }}
          >
            打开完整界面
          </Button>
        </div>
      )}
      <div className="mitmproxy-viewer-content">
        <TrafficList deviceId={deviceId} />
      </div>
    </div>
  );
};

export default MitmproxyViewer;
