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
import { useWebSocketManager } from '../hooks/useWebSocketManager'

const { Text } = Typography

const ScreenDisplay = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { devices, selectedDevice } = useSelector((state: RootState) => state.devices)
  
  const [quality, setQuality] = useState(2) // 视频质量(1-5 Mbps)
  const [resolution, setResolution] = useState(1080) // 分辨率
  const [fullscreen, setFullscreen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  
  // 使用全局WebSocket管理器（切换菜单时不会断开连接）
  const { lastMessage, readyState, isConnected } = useWebSocketManager(selectedDevice)
  
  // 连接状态提示
  useEffect(() => {
    if (selectedDevice && isConnected) {
      console.log('屏幕连接已建立')
    } else if (selectedDevice && !isConnected && readyState === 3) { // 3 = CLOSED
      console.log('屏幕连接已断开')
    }
  }, [selectedDevice, isConnected, readyState])
  
  // 处理屏幕截图流
  useEffect(() => {
    if (!lastMessage) return
    
    try {
      // lastMessage 已经是解析后的对象（从 useWebSocketManager 返回）
      // 格式: {type: 'screenshot', data: 'data:image/png;base64,...', frame: 2}
      const data = lastMessage
      
      console.log('处理消息:', data.type, data.frame ? `帧#${data.frame}` : '', 'data类型:', typeof data.data)
      
      if (data.type === 'screenshot' && data.data) {
        console.log(`收到截图帧 #${data.frame}, 数据长度: ${data.data.length}`)
        
        // 使用ID选择器，更可靠
        const container = document.getElementById('screen-container')
        console.log('容器元素:', container ? '找到' : '未找到')
        
        if (!container) {
          console.warn('❌ 找不到屏幕容器元素 #screen-container')
          return
        }
        
        // 查找或创建img元素
        let img = container.querySelector('img') as HTMLImageElement
        if (!img) {
          console.log('创建新的img元素')
          img = document.createElement('img')
          img.style.width = '100%'
          img.style.height = '100%'
          img.style.objectFit = 'contain'
          img.style.display = 'block'
          img.style.maxWidth = '100%'
          img.style.maxHeight = '100%'
          container.appendChild(img)
        }
        
        // 更新图片源（data.data 已经是 data:image/png;base64,... 格式）
        console.log('设置图片源，数据前缀:', data.data.substring(0, 50))
        img.src = data.data
        
        img.onerror = (e) => {
          console.error('❌ 图片加载失败:', e)
          console.error('数据长度:', data.data?.length)
          console.error('数据前缀:', data.data?.substring(0, 200))
        }
        
        img.onload = () => {
          console.log('✅ 图片加载成功，尺寸:', img.naturalWidth, 'x', img.naturalHeight)
        }
      } else if (data.type === 'error') {
        console.error('屏幕流错误:', data.message)
        message.error(`屏幕流错误: ${data.message}`)
      } else {
        console.log('未知消息类型:', data.type, data)
      }
    } catch (e) {
      console.error('处理屏幕数据失败:', e, lastMessage)
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
                  {/* 截图会通过useEffect动态添加到这个容器 */}
                  {connectionStatus !== 1 && (
                    <Text type="warning" style={{ color: '#fff' }}>等待连接...</Text>
                  )}
                </div>
              )}
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default ScreenDisplay

