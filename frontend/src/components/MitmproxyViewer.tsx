/**
 * Mitmproxy Web 界面查看器
 * 通过 iframe 嵌入 mitmweb 界面
 */

import React, { useEffect, useState } from 'react';
import { Spin, Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { startMitmweb, getMitmwebStatus } from '../api/mitmproxyApi';
import './MitmproxyViewer.css';

interface MitmproxyViewerProps {
  deviceId: string;
}

type ViewerStatus = 'loading' | 'starting' | 'online' | 'error';

const MitmproxyViewer: React.FC<MitmproxyViewerProps> = ({ deviceId }) => {
  const [status, setStatus] = useState<ViewerStatus>('loading');
  const [proxyUrl, setProxyUrl] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [proxyInfo, setProxyInfo] = useState<{ host: string; port: number } | null>(null);

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
        setProxyUrl(statusData.proxy_url || '');
        // 获取电脑的实际 IP 地址（从后端获取）
        const host = statusData.proxy_host || window.location.hostname;
        setProxyInfo({
          host: host,
          port: statusData.proxy_port || 0,
        });
        setStatus('online');
      } else {
        // 需要启动
        setStatus('starting');
        const startResult = await startMitmweb(deviceId);

        if (startResult.success) {
          setProxyUrl(startResult.proxy_url || '');
          const host = startResult.proxy_host || window.location.hostname;
          setProxyInfo({
            host: host,
            port: startResult.proxy_port || 0,
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
            <Button 
              size="small" 
              onClick={() => window.location.reload()}
              style={{ marginLeft: 16 }}
            >
              刷新页面
            </Button>
          </div>
        </div>
      )}
      <div className="mitmproxy-viewer-content">
        <iframe
          src={proxyUrl}
          className="mitmproxy-iframe"
          title="mitmproxy"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        />
      </div>
    </div>
  );
};

export default MitmproxyViewer;
