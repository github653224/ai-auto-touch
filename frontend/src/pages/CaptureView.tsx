/**
 * 抓包页面
 * 左侧显示手机屏幕和控制按钮，右侧显示 mitmproxy 界面
 */

import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, PageHeader } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import MitmproxyViewer from '../components/MitmproxyViewer';
import ScrcpyPlayer from '../components/ScrcpyPlayer';
import './CaptureView.css';

const CaptureView: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();

  if (!deviceId) {
    return <div>设备 ID 不存在</div>;
  }

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="capture-view">
      {/* Header */}
      <div className="capture-header">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          type="text"
        >
          返回
        </Button>
        <h2 className="capture-title">设备抓包 - {deviceId}</h2>
        <div className="capture-header-actions">
          {/* 可以添加其他操作按钮 */}
        </div>
      </div>

      {/* Content */}
      <div className="capture-content">
        {/* 左侧：手机屏幕和控制 */}
        <div className="capture-left-panel">
          <div className="phone-screen-wrapper">
            <ScrcpyPlayer deviceId={deviceId} />
          </div>
          
          <div className="phone-controls">
            <div className="control-section">
              <h4>系统按键</h4>
              <div className="button-group">
                <Button>返回</Button>
                <Button>主页</Button>
                <Button>多任务</Button>
              </div>
            </div>

            <div className="control-section">
              <h4>常用操作</h4>
              <div className="button-group">
                <Button>截图</Button>
                <Button>录屏</Button>
                <Button>旋转</Button>
              </div>
              <div className="button-group">
                <Button>音量+</Button>
                <Button>音量-</Button>
                <Button>电源</Button>
              </div>
            </div>

            <div className="control-section">
              <h4>手势操作</h4>
              <div className="button-group">
                <Button>上滑</Button>
                <Button>下滑</Button>
                <Button>下拉通知</Button>
              </div>
              <div className="button-group">
                <Button>左滑</Button>
                <Button>右滑</Button>
              </div>
            </div>

            <div className="control-section">
              <h4>代理控制</h4>
              <div className="button-group">
                <Button type="primary">设置代理</Button>
                <Button>清除代理</Button>
              </div>
              <div className="button-group">
                <Button>安装证书</Button>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：mitmproxy 界面 */}
        <div className="capture-right-panel">
          <MitmproxyViewer deviceId={deviceId} />
        </div>
      </div>
    </div>
  );
};

export default CaptureView;
