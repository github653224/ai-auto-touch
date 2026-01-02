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
  Tag,
  Input,
  Divider,
  Tooltip
} from 'antd'
import { 
  ArrowLeftOutlined,
  FullscreenOutlined,
  HomeOutlined,
  RollbackOutlined,
  MenuOutlined,
  PoweroffOutlined,
  SoundOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ArrowLeftOutlined as ArrowLeft,
  ArrowRightOutlined,
  SendOutlined,
  ClearOutlined,
  BellOutlined,
  SettingOutlined,
  LockOutlined,
  AppstoreOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useWebSocketManager } from '../hooks/useWebSocketManager'
import { phoneControlApi } from '../api/phoneControlApi'
// import { useH264Player } from '../hooks/useH264Player' // 已禁用视频流模式

const { Text, Title, Paragraph } = Typography

const ScreenDisplay = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { devices, selectedDevice } = useSelector((state: RootState) => state.devices)
  
  const [quality, setQuality] = useState(4) // 视频质量(1-8 Mbps)，默认4Mbps
  const [resolution, setResolution] = useState(1080) // 分辨率，默认1080p
  const [fullscreen, setFullscreen] = useState(false)
  const [textInput, setTextInput] = useState('') // 文本输入框
  const [screenSize, setScreenSize] = useState<{ width: number; height: number } | null>(null) // 屏幕尺寸
  const [isControlling, setIsControlling] = useState(false) // 控制操作中
  // const videoRef = useRef<HTMLVideoElement>(null) // 已移除，不再使用
  const screenContainerRef = useRef<HTMLDivElement>(null) // 用于全屏的容器引用
  // const canvasRef = useRef<HTMLCanvasElement>(null) // 已移除，只使用截图模式
  // const [useVideo] = useState(false) // 禁用视频流模式，只使用截图模式
  // const [connectionTimeout, setConnectionTimeout] = useState(false) // 连接超时标志（已移除）
  
  // 使用全局WebSocket管理器（截图流）
  // 注意：视频流模式已禁用，只使用截图模式
  const { lastMessage, readyState, isConnected: screenshotConnected } = useWebSocketManager(
    selectedDevice
  )
  
  // 视频流模式已禁用
  /*
  // 当切换到视频模式时，确保截图模式的连接被正确清理
  useEffect(() => {
    if (useVideo && readyState === WebSocket.OPEN) {
      // 如果切换到视频模式但截图连接还在，需要断开截图模式的连接
      // 因为 H264 模式使用自己的 WebSocket 连接
      console.log('切换到 H264 模式，断开截图模式连接')
      // 注意：useWebSocketManager 会在 url 变为 null 时自动断开连接
      // 但这里我们确保在切换模式时立即断开
    }
  }, [useVideo, readyState])

  // H264 WebSocket 播放器（推荐，简单可靠）
  const { supported: h264Supported, error: h264Error, stats: h264Stats, updateConfig } = useH264Player({
    deviceId: selectedDevice,
    enabled: useVideo, // 直接使用 H264 模式
    canvasRef,
    maxSize: resolution,
    bitRate: quality,
  })
  
  // 调试日志：显示 updateConfig 是否可用
  useEffect(() => {
    console.log('🔍 ScreenDisplay 状态:', {
      useVideo,
      hasUpdateConfig: !!updateConfig,
      h264Supported,
      selectedDevice
    })
  }, [useVideo, updateConfig, h264Supported, selectedDevice])
  
  // 使用 H264 WebSocket 模式
  const videoSupported = h264Supported
  const videoError = h264Error
  const videoStats = h264Stats
  */
  
  // 禁用视频流模式相关变量（已注释）
  /*
  const videoSupported = false
  const videoError = null
  const videoStats = null
  const updateConfig = undefined
  */
  
  // 连接超时检测已禁用（视频流模式已禁用）
  /*
  // 连接超时检测：如果视频流连接超过10秒仍未成功，标记为超时
  useEffect(() => {
    if (!useVideo || !selectedDevice) {
      setConnectionTimeout(false)
      return
    }
    
    // 如果已经连接成功，清除超时标志
    if (videoSupported && !videoError) {
      setConnectionTimeout(false)
      return
    }
    
    // 如果浏览器不支持 WebCodecs，立即标记为超时
    if (typeof window !== 'undefined' && 
        typeof (window as any).VideoDecoder === 'undefined') {
      setConnectionTimeout(true)
      return
    }
    
    // 设置超时检测
    const timeoutId = setTimeout(() => {
      if (!videoSupported || videoError) {
        setConnectionTimeout(true)
        message.warning('视频流连接超时，建议切换到截图模式', 5)
      }
    }, 15000) // 增加到15秒超时
    
    return () => clearTimeout(timeoutId)
  }, [useVideo, selectedDevice, videoSupported, videoError])
  */
  
  // 连接状态提示（只使用截图模式）
  useEffect(() => {
    const connected = screenshotConnected
    if (selectedDevice && connected) {
      console.log('屏幕连接已建立 - 截图模式')
    } else if (selectedDevice && !connected && readyState === 3) { // 3 = CLOSED
      console.log('屏幕连接已断开')
    }
  }, [selectedDevice, screenshotConnected, readyState])
  
  // 处理屏幕截图流
  useEffect(() => {
    if (!lastMessage) return
    
    try {
      const data = lastMessage
      if (data.type === 'screenshot' && data.data) {
        const container = document.getElementById('screen-container')
        if (!container) {
          console.warn('❌ 找不到屏幕容器元素 #screen-container，等待容器渲染...')
          // 延迟重试，等待容器渲染
          setTimeout(() => {
            const retryContainer = document.getElementById('screen-container')
            if (retryContainer) {
              let img = retryContainer.querySelector('img') as HTMLImageElement
              if (!img) {
                img = document.createElement('img')
                img.style.width = '100%'
                img.style.height = '100%'
                img.style.objectFit = 'contain'
                img.style.display = 'block'
                img.style.maxWidth = '100%'
                img.style.maxHeight = '100%'
                retryContainer.appendChild(img)
              }
              // 释放旧的 Blob URL
              if (img.src && img.src.startsWith('blob:')) {
                URL.revokeObjectURL(img.src)
              }
              img.src = data.data
              console.log('✅ 截图已显示（延迟渲染）')
            }
          }, 100)
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
          console.log('✅ 创建截图图片元素')
        }
        // 释放旧的 Blob URL（避免内存泄漏）
        if (img.src && img.src.startsWith('blob:')) {
          URL.revokeObjectURL(img.src)
        }
        img.src = data.data
        // 只在第一帧或每30帧记录一次日志
        const frameCount = (window as any).__screenshotFrameCount = ((window as any).__screenshotFrameCount || 0) + 1
        if (frameCount === 1 || frameCount % 30 === 0) {
          console.log(`✅ 截图已更新（第 ${frameCount} 帧）`)
        }
      } else if (data.type === 'error') {
        console.error('截图模式错误:', data.message)
        message.error(`屏幕流错误: ${data.message}`)
      } else if (data.type === 'connected') {
        console.log('✅ 截图模式已连接:', data.message)
      } else {
        console.log('收到其他类型的消息:', data.type)
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
    const container = screenContainerRef.current
    if (!container) {
      message.error('无法进入全屏模式')
      return
    }
    
    if (!fullscreen) {
      // 进入全屏
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(e => {
          message.error(`全屏失败: ${e.message}`)
        })
      } else {
        message.error('浏览器不支持全屏功能')
      }
    } else {
      // 退出全屏
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }
  
  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])
  
  // 调整视频质量（截图模式下不支持实时更新）
  const handleQualityChange = (value: number) => {
    setQuality(value)
    console.log('🎨 调整视频质量:', { value })
    message.info(`视频质量已调整为 ${value} Mbps，将在下次连接时生效`)
  }
  
  // 调整分辨率（截图模式下不支持实时更新）
  const handleResolutionChange = (value: number) => {
    setResolution(value)
    console.log('📐 调整分辨率:', { value })
    message.info(`分辨率已调整为 ${value}p，将在下次连接时生效`)
  }
  
  // 设备选项
  const deviceOptions = devices.map(device => ({
    label: `${device.device_id} (${device.name || '未知设备'})`,
    value: device.device_id
  }))
  
  // 连接状态判断（只使用截图模式）
  const isConnected = readyState === 1 || screenshotConnected
  
  // readyState: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED
  const connectionStatus = isConnected ? 1 : readyState
  
  // 调试日志：帮助诊断连接问题（截图模式）
  useEffect(() => {
    if (selectedDevice) {
      console.log('截图模式连接状态:', {
        readyState,
        screenshotConnected,
        isConnected,
        connectionStatus,
        lastMessage: lastMessage?.type
      })
    }
  }, [selectedDevice, readyState, screenshotConnected, isConnected, connectionStatus, lastMessage])
  
  // 获取屏幕尺寸
  useEffect(() => {
    if (selectedDevice && isConnected) {
      phoneControlApi.getScreenSize(selectedDevice)
        .then(res => {
          if (res.data.success) {
            setScreenSize({ width: res.data.width, height: res.data.height })
            console.log('屏幕尺寸:', res.data.width, 'x', res.data.height)
          }
        })
        .catch(err => console.error('获取屏幕尺寸失败:', err))
    }
  }, [selectedDevice, isConnected])
  
  // 处理屏幕点击
  const handleScreenClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedDevice || !screenSize || isControlling) return
    
    const container = e.currentTarget
    const rect = container.getBoundingClientRect()
    
    // 计算点击位置相对于容器的比例
    const relativeX = (e.clientX - rect.left) / rect.width
    const relativeY = (e.clientY - rect.top) / rect.height
    
    // 转换为设备坐标
    const deviceX = Math.round(relativeX * screenSize.width)
    const deviceY = Math.round(relativeY * screenSize.height)
    
    console.log('点击屏幕:', { relativeX, relativeY, deviceX, deviceY })
    
    setIsControlling(true)
    try {
      const response = await phoneControlApi.tap(selectedDevice, { x: deviceX, y: deviceY })
      if (response.data.success) {
        message.success(`已点击 (${deviceX}, ${deviceY})`, 1)
      }
    } catch (error) {
      message.error('点击失败')
      console.error('点击失败:', error)
    } finally {
      setIsControlling(false)
    }
  }
  
  // 控制按钮处理函数
  const handleControl = async (action: () => Promise<any>, actionName: string) => {
    if (!selectedDevice || isControlling) return
    
    setIsControlling(true)
    try {
      const response = await action()
      if (response.data.success) {
        message.success(response.data.message || `${actionName}成功`, 1)
      }
    } catch (error) {
      message.error(`${actionName}失败`)
      console.error(`${actionName}失败:`, error)
    } finally {
      setIsControlling(false)
    }
  }
  
  // 文本输入
  const handleSendText = async () => {
    if (!textInput.trim() || !selectedDevice) return
    
    await handleControl(
      () => phoneControlApi.inputText(selectedDevice, { text: textInput }),
      '输入文本'
    )
    setTextInput('')
  }
  
  // 清除文本
  const handleClearText = async () => {
    if (!selectedDevice) return
    await handleControl(
      () => phoneControlApi.clearText(selectedDevice, 50),
      '清除文本'
    )
  }

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
          <Title level={4} style={{ margin: 0 }}>实时屏幕显示</Title>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
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
        </div>
        
        <Row gutter={0} style={{ marginTop: 0, flex: 1, overflow: 'hidden' }}>
          {/* 左侧：实时屏幕预览 */}
          <Col xs={24} lg={9} style={{ paddingRight: 12, display: 'flex', alignItems: 'stretch', paddingTop: 0, paddingBottom: 0, height: '100%' }}>
            <div
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '0 4px',
                height: '100%',
              }}
            >
              <div
                ref={screenContainerRef}
                style={{
                  width: 420,
                  maxWidth: '70%',
                  maxHeight: 'calc(100vh - 120px)',
                  aspectRatio: '1290 / 2796', // iPhone 15 Pro Max 比例
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
                }}
              >
                <div
                  id="screen-container"
                  onClick={handleScreenClick}
                  style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 20,
                    overflow: 'hidden',
                    backgroundColor: '#000',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'relative',
                    cursor: selectedDevice && isConnected ? 'pointer' : 'default',
                  }}
                >
                  {/* 只使用截图模式 - Canvas 已移除 */}
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {/* img 元素会在 useEffect 中动态创建 */}
                  </div>
                  
                  {/* 加载状态和错误提示 */}
                  {!selectedDevice ? (
                    <div style={{ 
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      color: '#fff',
                      zIndex: 10
                    }}>
                      <Text type="warning" style={{ color: '#fff' }}>
                        请选择设备以查看实时画面
                      </Text>
                    </div>
                  ) : connectionStatus !== 1 ? (
                    <div style={{ 
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      textAlign: 'center',
                      color: '#fff',
                      zIndex: 10
                    }}>
                      <Spin size="large">
                        <div style={{ marginTop: 8 }}>
                          <div>正在连接屏幕...</div>
                        </div>
                      </Spin>
                    </div>
                  ) : null}
                  {selectedDevice && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        padding: '4px 8px',
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: 4,
                        fontSize: 12,
                      }}
                    >
                      <Text
                        type={connectionStatus === 1 ? 'success' : 'danger'}
                        style={{ color: connectionStatus === 1 ? '#52c41a' : '#ff4d4f', fontSize: 12 }}
                      >
                        {connectionStatus === 1 ? '已连接' : '未连接'}
                      </Text>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Col>

          {/* 右侧：控制区域 */}
          <Col xs={24} lg={15} style={{ paddingLeft: 12, borderLeft: '1px solid #e8e8e8', height: '100%', overflow: 'auto' }}>
            <div style={{ padding: '16px' }}>
              {/* 设备与画质设置 */}
              <Typography.Title level={5} style={{ marginTop: 0 }}>设备与画质设置</Typography.Title>
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <div>
                  <Text strong>选择设备：</Text>
                  <Select
                    value={selectedDevice}
                    onChange={handleDeviceChange}
                    options={deviceOptions}
                    style={{ width: '100%', marginTop: 8 }}
                    placeholder="请选择设备"
                  />
                </div>

                {/* 显示模式开关已移除 - 只使用截图模式 */}
                <div>
                  <Space size="small" style={{ marginBottom: 8 }}>
                    <Text strong>显示模式：</Text>
                    <Tag>截图流</Tag>
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
                </div>

                <div>
                  <Text strong>视频质量：</Text>
                  <Text>{quality} Mbps</Text>
                  <Slider 
                    min={1} 
                    max={5} 
                    value={quality} 
                    onChange={handleQualityChange}
                    step={0.5}
                    style={{ marginTop: 8 }}
                  />
                </div>
                
                <div>
                  <Text strong>分辨率：</Text>
                  <Text>{resolution}p</Text>
                  <Slider 
                    min={480} 
                    max={2160} 
                    value={resolution} 
                    onChange={handleResolutionChange}
                    step={null}
                    marks={{
                      480: '480p',
                      720: '720p',
                      1080: '1080p',
                      2160: '4K'
                    }}
                    style={{ marginTop: 8 }}
                  />
                </div>
              </Space>

              <Divider />

              {/* 手机控制面板 */}
              <Typography.Title level={5}>手机控制</Typography.Title>
              <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 16 }}>
                点击屏幕图像可直接操作手机，或使用下方按钮控制
              </Paragraph>

              {/* 虚拟按键 */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>虚拟按键</Text>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Tooltip title="返回主屏幕">
                    <Button 
                      icon={<HomeOutlined />}
                      onClick={() => handleControl(() => phoneControlApi.pressHome(selectedDevice!), '按Home键')}
                      disabled={!selectedDevice || isControlling}
                    >
                      Home
                    </Button>
                  </Tooltip>
                  <Tooltip title="返回上一页">
                    <Button 
                      icon={<RollbackOutlined />}
                      onClick={() => handleControl(() => phoneControlApi.pressBack(selectedDevice!), '按返回键')}
                      disabled={!selectedDevice || isControlling}
                    >
                      返回
                    </Button>
                  </Tooltip>
                  <Tooltip title="切换应用（最近任务）">
                    <Button 
                      icon={<AppstoreOutlined />}
                      onClick={() => handleControl(() => phoneControlApi.pressAppSwitch(selectedDevice!), '切换应用')}
                      disabled={!selectedDevice || isControlling}
                    >
                      切换
                    </Button>
                  </Tooltip>
                  <Tooltip title="打开菜单">
                    <Button 
                      icon={<MenuOutlined />}
                      onClick={() => handleControl(() => phoneControlApi.pressMenu(selectedDevice!), '按菜单键')}
                      disabled={!selectedDevice || isControlling}
                    >
                      菜单
                    </Button>
                  </Tooltip>
                  <Tooltip title="电源键">
                    <Button 
                      icon={<PoweroffOutlined />}
                      onClick={() => handleControl(() => phoneControlApi.pressPower(selectedDevice!), '按电源键')}
                      disabled={!selectedDevice || isControlling}
                      danger
                    >
                      电源
                    </Button>
                  </Tooltip>
                </div>
              </div>

              {/* 音量控制 */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>音量控制</Text>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <Button 
                    icon={<SoundOutlined />}
                    onClick={() => handleControl(() => phoneControlApi.pressVolumeUp(selectedDevice!), '音量+')}
                    disabled={!selectedDevice || isControlling}
                  >
                    音量+
                  </Button>
                  <Button 
                    icon={<SoundOutlined />}
                    onClick={() => handleControl(() => phoneControlApi.pressVolumeDown(selectedDevice!), '音量-')}
                    disabled={!selectedDevice || isControlling}
                  >
                    音量-
                  </Button>
                </div>
              </div>

              {/* 滚动控制 */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>滚动控制</Text>
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
                    <Tooltip title="向上滚动">
                      <Button 
                        icon={<ArrowUpOutlined />}
                        onClick={() => handleControl(() => phoneControlApi.scrollUp(selectedDevice!, { distance: 500 }), '向上滚动')}
                        disabled={!selectedDevice || isControlling}
                      />
                    </Tooltip>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                    <Tooltip title="向左滚动">
                      <Button 
                        icon={<ArrowLeft />}
                        onClick={() => handleControl(() => phoneControlApi.scrollLeft(selectedDevice!, { distance: 500 }), '向左滚动')}
                        disabled={!selectedDevice || isControlling}
                      />
                    </Tooltip>
                    <Tooltip title="向下滚动">
                      <Button 
                        icon={<ArrowDownOutlined />}
                        onClick={() => handleControl(() => phoneControlApi.scrollDown(selectedDevice!, { distance: 500 }), '向下滚动')}
                        disabled={!selectedDevice || isControlling}
                      />
                    </Tooltip>
                    <Tooltip title="向右滚动">
                      <Button 
                        icon={<ArrowRightOutlined />}
                        onClick={() => handleControl(() => phoneControlApi.scrollRight(selectedDevice!, { distance: 500 }), '向右滚动')}
                        disabled={!selectedDevice || isControlling}
                      />
                    </Tooltip>
                  </div>
                </div>
              </div>

              {/* 文本输入 */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>文本输入</Text>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <Input 
                    placeholder="输入文本..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onPressEnter={handleSendText}
                    disabled={!selectedDevice || isControlling}
                    style={{ flex: 1 }}
                  />
                  <Tooltip title="发送文本">
                    <Button 
                      icon={<SendOutlined />}
                      type="primary"
                      onClick={handleSendText}
                      disabled={!selectedDevice || isControlling || !textInput.trim()}
                    >
                      发送
                    </Button>
                  </Tooltip>
                  <Tooltip title="清除输入框内容">
                    <Button 
                      icon={<ClearOutlined />}
                      onClick={handleClearText}
                      disabled={!selectedDevice || isControlling}
                    >
                      清除
                    </Button>
                  </Tooltip>
                </div>
              </div>

              {/* 系统操作 */}
              <div style={{ marginBottom: 16 }}>
                <Text strong>系统操作</Text>
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <Tooltip title="解锁屏幕">
                    <Button 
                      icon={<LockOutlined />}
                      onClick={() => handleControl(() => phoneControlApi.unlockScreen(selectedDevice!), '解锁屏幕')}
                      disabled={!selectedDevice || isControlling}
                    >
                      解锁
                    </Button>
                  </Tooltip>
                  <Tooltip title="打开通知栏">
                    <Button 
                      icon={<BellOutlined />}
                      onClick={() => handleControl(() => phoneControlApi.openNotification(selectedDevice!), '打开通知栏')}
                      disabled={!selectedDevice || isControlling}
                    >
                      通知
                    </Button>
                  </Tooltip>
                  <Tooltip title="打开快捷设置">
                    <Button 
                      icon={<SettingOutlined />}
                      onClick={() => handleControl(() => phoneControlApi.openQuickSettings(selectedDevice!), '打开快捷设置')}
                      disabled={!selectedDevice || isControlling}
                    >
                      设置
                    </Button>
                  </Tooltip>
                  <Tooltip title="关闭通知栏">
                    <Button 
                      onClick={() => handleControl(() => phoneControlApi.closeNotification(selectedDevice!), '关闭通知栏')}
                      disabled={!selectedDevice || isControlling}
                    >
                      关闭通知
                    </Button>
                  </Tooltip>
                </div>
              </div>

              {screenSize && (
                <div style={{ marginTop: 16, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    屏幕尺寸: {screenSize.width} × {screenSize.height}
                  </Text>
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

