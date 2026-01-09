/**
 * 抓包页面
 * 参考屏幕显示页面的布局：左侧手机屏幕，右侧控制和 mitmproxy 界面
 */

import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Space, Typography, Row, Col, Card, Divider, Tooltip, message } from 'antd';
import { 
  ArrowLeftOutlined,
  HomeOutlined,
  RollbackOutlined,
  AppstoreOutlined,
  CameraOutlined,
  RotateRightOutlined,
  SoundOutlined,
  PoweroffOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ArrowLeftOutlined as SwipeLeftIcon,
  ArrowRightOutlined as SwipeRightIcon,
  WifiOutlined,
  SafetyCertificateOutlined,
  BellOutlined
} from '@ant-design/icons';
import MitmproxyViewer from '../components/MitmproxyViewer';
import { ScrcpyPlayer } from '../components/ScrcpyPlayer';
import { phoneControlApi } from '../api/phoneControlApi';
import './CaptureView.css';

const { Title, Text } = Typography;

const CaptureView: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const [isControlling, setIsControlling] = useState(false);

  if (!deviceId) {
    return <div>设备 ID 不存在</div>;
  }

  const handleBack = () => {
    navigate('/');
  };

  // 通用控制处理函数
  const handleControl = async (action: () => Promise<any>, actionName: string) => {
    if (isControlling) return;
    
    setIsControlling(true);
    try {
      const response = await action();
      if (response.data.success) {
        message.success(response.data.message || `${actionName}成功`, 1);
      }
    } catch (error) {
      message.error(`${actionName}失败`);
      console.error(`${actionName}失败:`, error);
    } finally {
      setIsControlling(false);
    }
  };

  // 视频流回调
  const handleVideoReady = useCallback(() => {
    message.success('视频流已连接');
  }, []);
  
  const handleVideoError = useCallback((err: string) => {
    message.error(`视频流错误: ${err}`);
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Card 
        styles={{ body: { padding: '0', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
        style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        variant="borderless"
      >
        {/* 顶部标题栏 */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '0px 16px',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Title level={4} style={{ margin: 0 }}>设备抓包 - {deviceId}</Title>
          <Space>
            <Text type="secondary" style={{ marginRight: 16 }}>抓包界面</Text>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
              返回设备列表
            </Button>
          </Space>
        </div>
        
        <Row gutter={0} style={{ marginTop: 0, flex: 1, overflow: 'hidden' }}>
          {/* 左侧：手机屏幕 */}
          <Col xs={24} lg={6} style={{ display: 'flex', alignItems: 'stretch', paddingTop: 0, paddingBottom: 0, height: '100%' }}>
            <div style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center',
              padding: '0 8px',
              height: '100%',
            }}>
              <div style={{
                width: '100%',
                maxWidth: 380,
                maxHeight: 'calc(100vh - 120px)',
                aspectRatio: '1290 / 2796',
                borderRadius: 28,
                padding: 8,
                background: '#1f1f1f',
                boxShadow: '0 12px 28px rgba(0,0,0,0.25)',
                border: '4px solid #2d2d2d',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: 0,
                marginBottom: 0,
              }}>
                <div style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 20,
                  overflow: 'hidden',
                  backgroundColor: '#000',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  position: 'relative',
                }}>
                  <ScrcpyPlayer 
                    deviceId={deviceId}
                    onReady={handleVideoReady}
                    onError={handleVideoError}
                  />
                </div>
              </div>
            </div>
          </Col>

          {/* 中间：操作按钮 */}
          <Col xs={24} lg={2} style={{ borderLeft: '1px solid #e8e8e8', borderRight: '1px solid #e8e8e8', height: '100%', overflow: 'auto', padding: '12px 4px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* 虚拟按键 */}
              <div>
                <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>系统</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Tooltip title="返回主屏幕" placement="right">
                    <Button 
                      icon={<HomeOutlined />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => handleControl(() => phoneControlApi.pressHome(deviceId), '按Home键')}
                      disabled={isControlling}
                    >
                      Home
                    </Button>
                  </Tooltip>
                  <Tooltip title="返回上一页" placement="right">
                    <Button 
                      icon={<RollbackOutlined />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => handleControl(() => phoneControlApi.pressBack(deviceId), '按返回键')}
                      disabled={isControlling}
                    >
                      返回
                    </Button>
                  </Tooltip>
                  <Tooltip title="切换应用" placement="right">
                    <Button 
                      icon={<AppstoreOutlined />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => handleControl(() => phoneControlApi.pressAppSwitch(deviceId), '切换应用')}
                      disabled={isControlling}
                    >
                      切换
                    </Button>
                  </Tooltip>
                </div>
              </div>

              <Divider style={{ margin: '6px 0' }} />

              {/* 常用操作 */}
              <div>
                <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>操作</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Tooltip title="截图" placement="right">
                    <Button 
                      icon={<CameraOutlined />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => handleControl(() => phoneControlApi.screenshot(deviceId), '截图')}
                      disabled={isControlling}
                    >
                      截图
                    </Button>
                  </Tooltip>
                  <Tooltip title="旋转屏幕" placement="right">
                    <Button 
                      icon={<RotateRightOutlined />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => message.info('旋转功能开发中')}
                      disabled={isControlling}
                    >
                      旋转
                    </Button>
                  </Tooltip>
                  <Tooltip title="电源键" placement="right">
                    <Button 
                      icon={<PoweroffOutlined />} 
                      size="small" 
                      block 
                      danger 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => handleControl(() => phoneControlApi.pressPower(deviceId), '按电源键')}
                      disabled={isControlling}
                    >
                      电源
                    </Button>
                  </Tooltip>
                </div>
              </div>

              <Divider style={{ margin: '6px 0' }} />

              {/* 音量控制 */}
              <div>
                <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>音量</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Tooltip title="音量+" placement="right">
                    <Button 
                      icon={<SoundOutlined />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => handleControl(() => phoneControlApi.pressVolumeUp(deviceId), '音量+')}
                      disabled={isControlling}
                    >
                      音量+
                    </Button>
                  </Tooltip>
                  <Tooltip title="音量-" placement="right">
                    <Button 
                      icon={<SoundOutlined />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => handleControl(() => phoneControlApi.pressVolumeDown(deviceId), '音量-')}
                      disabled={isControlling}
                    >
                      音量-
                    </Button>
                  </Tooltip>
                </div>
              </div>

              <Divider style={{ margin: '6px 0' }} />

              {/* 手势操作 */}
              <div>
                <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>手势</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Tooltip title="向上滑动" placement="right">
                    <Button 
                      icon={<ArrowUpOutlined />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => handleControl(() => phoneControlApi.unlockScreen(deviceId), '向上滑动')}
                      disabled={isControlling}
                    >
                      上滑
                    </Button>
                  </Tooltip>
                  <Tooltip title="向下滑动" placement="right">
                    <Button 
                      icon={<ArrowDownOutlined />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => handleControl(() => phoneControlApi.swipeDown(deviceId), '向下滑动')}
                      disabled={isControlling}
                    >
                      下滑
                    </Button>
                  </Tooltip>
                  <Tooltip title="向左滑动" placement="right">
                    <Button 
                      icon={<SwipeLeftIcon />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => handleControl(() => phoneControlApi.scrollLeft(deviceId), '向左滑动')}
                      disabled={isControlling}
                    >
                      左滑
                    </Button>
                  </Tooltip>
                  <Tooltip title="向右滑动" placement="right">
                    <Button 
                      icon={<SwipeRightIcon />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => handleControl(() => phoneControlApi.scrollRight(deviceId), '向右滑动')}
                      disabled={isControlling}
                    >
                      右滑
                    </Button>
                  </Tooltip>
                  <Tooltip title="打开通知栏" placement="right">
                    <Button 
                      icon={<BellOutlined />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => handleControl(() => phoneControlApi.openNotification(deviceId), '打开通知栏')}
                      disabled={isControlling}
                    >
                      通知
                    </Button>
                  </Tooltip>
                </div>
              </div>

              <Divider style={{ margin: '6px 0' }} />

              {/* 代理控制 */}
              <div>
                <Text strong style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>代理</Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Tooltip title="设置代理" placement="right">
                    <Button 
                      icon={<WifiOutlined />} 
                      size="small" 
                      block 
                      type="primary" 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => message.info('代理设置功能开发中')}
                      disabled={isControlling}
                    >
                      设置
                    </Button>
                  </Tooltip>
                  <Tooltip title="清除代理" placement="right">
                    <Button 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => message.info('清除代理功能开发中')}
                      disabled={isControlling}
                    >
                      清除
                    </Button>
                  </Tooltip>
                  <Tooltip title="安装证书" placement="right">
                    <Button 
                      icon={<SafetyCertificateOutlined />} 
                      size="small" 
                      block 
                      style={{ fontSize: 11, height: 28, padding: '0 4px' }}
                      onClick={() => message.info('证书安装功能开发中')}
                      disabled={isControlling}
                    >
                      证书
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </div>
          </Col>

          {/* 右侧：mitmproxy 界面 */}
          <Col xs={24} lg={16} style={{ height: '100%', overflow: 'hidden' }}>
            <div style={{ height: '100%', padding: '16px' }}>
              <MitmproxyViewer deviceId={deviceId} />
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default CaptureView;
