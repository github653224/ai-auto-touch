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
  Space,
  Switch,
  Tag
} from 'antd'
import { 
  ArrowLeftOutlined,
  FullscreenOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useWebSocketManager } from '../hooks/useWebSocketManager'
import { useH264Player } from '../hooks/useH264Player'

const { Text } = Typography

const ScreenDisplay = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { devices, selectedDevice } = useSelector((state: RootState) => state.devices)
  
  const [quality, setQuality] = useState(2) // 视频质量(1-5 Mbps)
  const [resolution, setResolution] = useState(1080) // 分辨率
  const [fullscreen, setFullscreen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [useVideo, setUseVideo] = useState(true) // 优先使用低延迟视频流
  
  // 使用全局WebSocket管理器（截图流），仅在非视频模式下启用
  const { lastMessage, readyState, isConnected: screenshotConnected } = useWebSocketManager(
    useVideo ? null : selectedDevice
  )

  // H264 低延迟播放器（实验）
  const { supported: h264Supported, error: h264Error, stats: h264Stats } = useH264Player({
    deviceId: selectedDevice,
    enabled: useVideo,
    canvasRef,
  })
  
  // 连接状态提示
  useEffect(() => {
    const connected = useVideo ? h264Supported && !h264Error : screenshotConnected
    if (selectedDevice && connected) {
      console.log('屏幕连接已建立')
    } else if (selectedDevice && !connected && readyState === 3) { // 3 = CLOSED
      console.log('屏幕连接已断开')
    }
  }, [selectedDevice, useVideo, h264Supported, h264Error, screenshotConnected, readyState])
  
  // 处理屏幕截图流（仅在非视频模式下）
  useEffect(() => {
    if (useVideo) return
    if (!lastMessage) return
    
    try {
      const data = lastMessage
      if (data.type === 'screenshot' && data.data) {
        const container = document.getElementById('screen-container')
        if (!container) {
          console.warn('❌ 找不到屏幕容器元素 #screen-container')
          return
        }
        let img = container.querySelector('img') as HTMLImageElement
        if (!img) {
          img = document.createElement('img')
          img.style.width = '100%'
          img.style.height = '100%'
          img.style.objectFit = 'contain'
          img.style.display = 'block'
          img.style.maxWidth = '100%'
          img.style.maxHeight = '100%'
          container.appendChild(img)
        }
        img.src = data.data
      } else if (data.type === 'error') {
        message.error(`屏幕流错误: ${data.message}`)
      }
    } catch (e) {
      console.error('处理屏幕数据失败:', e, lastMessage)
    }
  }, [lastMessage, useVideo])
  
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
  
  const isConnected = useVideo ? (h264Supported && !h264Error) : (readyState === 1)
  // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
  const connectionStatus = isConnected ? 1 : readyState
  
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
              <Space size="small">
                <Switch
                  checked={useVideo}
                  disabled={!h264Supported}
                  onChange={(checked) => setUseVideo(checked)}
                  checkedChildren="低延迟视频"
                  unCheckedChildren="截图模式"
                />
                {useVideo ? (
                  h264Error ? (
                    <Tag color="red">视频流错误</Tag>
                  ) : (
                    <Tag color="blue">视频流</Tag>
                  )
                ) : (
                  <Tag>截图流</Tag>
                )}
                {useVideo && h264Stats.frames > 0 && (
                  <Tag color="green">帧: {h264Stats.frames}</Tag>
                )}
              </Space>
              
              <Text>
                连接状态: {connectionStatus === 1 ? (
                  <Text type="success">已连接</Text>
                ) : connectionStatus === 0 ? (
                  <Text type="warning">连接中...</Text>
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
              ) : connectionStatus !== 1 ? (
                <Spin size="large" tip="正在连接屏幕...">
                  <div style={{ height: '100%' }} />
                </Spin>
              ) : (
                <>
                  {useVideo && h264Supported && !h264Error ? (
                    <canvas
                      ref={canvasRef}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        backgroundColor: '#000',
                      }}
                    />
                  ) : (
                    <div 
                      id="screen-container"
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        position: 'relative',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: '#000'
                      }}
                    >
                      <video 
                        ref={videoRef}
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '100%',
                          objectFit: 'contain',
                          display: 'none' // 隐藏video，使用img显示截图
                        }}
                        autoPlay
                        muted
                        playsInline
                      />
                      {connectionStatus !== 1 && (
                        <Text type="warning" style={{ color: '#fff' }}>等待连接...</Text>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default ScreenDisplay

