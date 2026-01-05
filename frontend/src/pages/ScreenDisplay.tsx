import { useEffect, useRef, useState, useCallback } from 'react'
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
  AppstoreOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { phoneControlApi } from '../api/phoneControlApi'
import { ScrcpyPlayer } from '../components/ScrcpyPlayer'

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
  const screenContainerRef = useRef<HTMLDivElement>(null) // 用于全屏的容器引用
  
  // 使用 useCallback 包装回调函数，避免重新渲染时重新连接
  const handleVideoReady = useCallback(() => {
    message.success('视频流已连接')
  }, [])
  
  const handleVideoError = useCallback((err: string) => {
    message.error(`视频流错误: ${err}`)
  }, [])
  
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
  
  // 调整视频质量
  const handleQualityChange = (value: number) => {
    setQuality(value)
    console.log('🎨 调整视频质量:', { value })
    message.info(`视频质量已调整为 ${value} Mbps，将在下次连接时生效`)
  }
  
  // 调整分辨率
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
  
  // 获取屏幕尺寸
  useEffect(() => {
    if (selectedDevice) {
      phoneControlApi.getScreenSize(selectedDevice)
        .then(res => {
          if (res.data.success) {
            setScreenSize({ width: res.data.width, height: res.data.height })
            console.log('屏幕尺寸:', res.data.width, 'x', res.data.height)
          }
        })
        .catch(err => console.error('获取屏幕尺寸失败:', err))
    }
  }, [selectedDevice])
  
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
                    cursor: selectedDevice ? 'pointer' : 'default',
                  }}
                >
                  {/* 视频流 */}
                  {selectedDevice && (
                    <ScrcpyPlayer
                      deviceId={selectedDevice}
                      maxSize={resolution}
                      bitRate={quality * 1_000_000}
                      onReady={handleVideoReady}
                      onError={handleVideoError}
                    />
                  )}
                  
                  {/* 加载状态和错误提示 */}
                  {!selectedDevice && (
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
                  )}
                  
                  {/* 视频流标签 */}
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
                      <Tag color="blue" style={{ margin: 0, fontSize: 11 }}>
                        视频流
                      </Tag>
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
                  <Tooltip title="向上滑动屏幕（解锁/刷新）">
                    <Button 
                      icon={<ArrowUpOutlined />}
                      onClick={() => handleControl(() => phoneControlApi.unlockScreen(selectedDevice!), '向上滑动')}
                      disabled={!selectedDevice || isControlling}
                    >
                      上滑
                    </Button>
                  </Tooltip>
                  <Tooltip title="向下滑动屏幕（下拉刷新）">
                    <Button 
                      icon={<ArrowDownOutlined />}
                      onClick={() => handleControl(() => phoneControlApi.swipeDown(selectedDevice!), '向下滑动')}
                      disabled={!selectedDevice || isControlling}
                    >
                      下滑
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

