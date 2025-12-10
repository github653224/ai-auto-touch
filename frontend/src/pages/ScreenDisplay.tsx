import { useEffect, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { RootState, AppDispatch } from '../store'
import { selectDevice } from '../features/deviceSlice'
import { 
  Card, 
  Select, 
  Button, 
  Row, 
  Col, 
  Typography, 
  Spin, 
  Slider,
  message,
  Space
} from 'antd'
import { 
  ArrowLeftOutlined,
  FullscreenOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import useWebSocket from 'react-use-websocket'

const { Title, Text } = Typography

const ScreenDisplay = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { devices, selectedDevice } = useSelector((state: RootState) => state.devices)
  
  const [quality, setQuality] = useState(2) // 视频质量(1-5 Mbps)
  const [resolution, setResolution] = useState(1080) // 分辨率
  const [fullscreen, setFullscreen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const wsUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  
  // WebSocket连接
  const { lastMessage, readyState } = useWebSocket(
    selectedDevice ? `${wsUrl.replace('http', 'ws')}/api/v1/ws/screen/${selectedDevice}` : '',
    {
      onOpen: () => {
        message.success('屏幕连接已建立')
      },
      onClose: () => {
        message.warning('屏幕连接已断开')
      },
      onError: (error) => {
        message.error(`连接错误: ${error.message}`)
      },
      share: true,
    }
  )
  
  // 处理视频流
  useEffect(() => {
    if (lastMessage && lastMessage.data instanceof Blob) {
      const videoBlob = new Blob([lastMessage.data], { type: 'video/mp4' })
      const videoUrl = URL.createObjectURL(videoBlob)
      
      if (videoRef.current) {
        videoRef.current.src = videoUrl
        videoRef.current.play().catch(e => console.error('播放失败:', e))
      }
    }
  }, [lastMessage])
  
  // 切换设备
  const handleDeviceChange = (deviceId: string) => {
    dispatch(selectDevice(deviceId))
  }
  
  // 返回设备列表
  const handleBack = () => {
    navigate('/')
  }
  
  // 全屏显示
  const handleFullscreen = () => {
    if (videoRef.current) {
      if (!fullscreen) {
        videoRef.current.requestFullscreen().catch(e => {
          message.error(`全屏失败: ${e.message}`)
        })
      } else {
        document.exitFullscreen()
      }
      setFullscreen(!fullscreen)
    }
  }
  
  // 调整视频质量
  const handleQualityChange = (value: number) => {
    setQuality(value)
    // 这里需要实现质量调整逻辑
    message.info(`视频质量已调整为 ${value} Mbps`)
  }
  
  // 调整分辨率
  const handleResolutionChange = (value: number) => {
    setResolution(value)
    // 这里需要实现分辨率调整逻辑
    message.info(`分辨率已调整为 ${value}p`)
  }
  
  // 设备选项
  const deviceOptions = devices.map(device => ({
    label: `${device.device_id} (${device.name || '未知设备'})`,
    value: device.device_id
  }))
  
  const isConnected = readyState === 1
  
  return (
    <div>
      <Card 
        title="实时屏幕显示" 
        extra={
          <Space>
            <Button 
              icon={<ArrowLeftOutlined />}
              onClick={handleBack}
            >
              返回设备列表
            </Button>
            <Button 
              icon={<FullscreenOutlined />}
              onClick={handleFullscreen}
              disabled={!selectedDevice}
            >
              {fullscreen ? '退出全屏' : '全屏显示'}
            </Button>
          </Space>
        }
      >
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Space align="center" style={{ marginBottom: 16 }}>
              <Text strong>选择设备：</Text>
              <Select
                value={selectedDevice}
                onChange={handleDeviceChange}
                options={deviceOptions}
                style={{ width: 300 }}
                placeholder="请选择设备"
              />
              
              <Button 
                icon={<SettingOutlined />}
                type="default"
              >
                画质设置
              </Button>
              
              <Text>
                连接状态: {isConnected ? (
                  <Text type="success">已连接</Text>
                ) : (
                  <Text type="danger">未连接</Text>
                )}
              </Text>
            </Space>
          </Col>
          
          <Col span={4}>
            <Card title="画质设置">
              <div style={{ marginBottom: 16 }}>
                <Text>视频质量: {quality} Mbps</Text>
                <Slider 
                  min={1} 
                  max={5} 
                  value={quality} 
                  onChange={handleQualityChange}
                  step={0.5}
                />
              </div>
              
              <div>
                <Text>分辨率: {resolution}p</Text>
                <Slider 
                  min={480} 
                  max={2160} 
                  value={resolution} 
                  onChange={handleResolutionChange}
                  step={1080}
                  marks={{
                    480: '480p',
                    720: '720p',
                    1080: '1080p',
                    2160: '4K'
                  }}
                />
              </div>
            </Card>
          </Col>
          
          <Col span={20}>
            <div style={{ 
              border: '1px solid #e8e8e8', 
              borderRadius: 4,
              overflow: 'hidden',
              backgroundColor: '#000',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '70vh'
            }}>
              {!selectedDevice ? (
                <Text type="warning">请选择一个已连接的设备</Text>
              ) : !isConnected ? (
                <Spin size="large" tip="正在连接屏幕...">
                  <div style={{ height: '100%' }} />
                </Spin>
              ) : (
                <video 
                  ref={videoRef}
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%',
                    objectFit: 'contain'
                  }}
                  autoPlay
                  muted
                  playsInline
                />
              )}
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default ScreenDisplay

