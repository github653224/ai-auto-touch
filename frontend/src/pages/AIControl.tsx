import { useEffect, useState, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import {
  Card,
  Select,
  Input,
  Button,
  Row,
  Col,
  Typography,
  message,
  Space,
  Divider,
  Tabs,
  List,
  Alert,
  Checkbox,
  Modal,
} from 'antd'
import { ArrowLeftOutlined, SendOutlined, ClearOutlined, BlockOutlined } from '@ant-design/icons'
import { useWebSocketManager } from '../hooks/useWebSocketManager'
import { RootState, AppDispatch } from '../store'
import { selectDevice } from '../features/deviceSlice'
import {
  executeNLCommand,
  executeBatchCommand,
  clearAIState,
  clearHistory,
} from '../features/aiSlice'

const { Title, Text } = Typography
const { TextArea } = Input

const AIControl = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { devices, selectedDevice } = useSelector((state: RootState) => state.devices)
  const { executing, result, error, history } = useSelector((state: RootState) => state.ai)

  const [command, setCommand] = useState('')
  const [batchCommands, setBatchCommands] = useState('')
  const [selectedDevices, setSelectedDevices] = useState<string[]>([])
  const [batchModalVisible, setBatchModalVisible] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  // 使用全局WebSocket管理器（切换菜单时不会断开连接）
  const { lastMessage, isConnected } = useWebSocketManager(selectedDevice)

  useEffect(() => {
    if (lastMessage && lastMessage.data) {
      try {
        // 处理JSON格式的截图数据
        if (typeof lastMessage.data === 'string') {
          const data = JSON.parse(lastMessage.data)
          if (data.type === 'screenshot' && data.data) {
            // 使用base64图片数据
            if (videoRef.current) {
              const img = document.createElement('img')
              img.src = data.data
              img.style.width = '100%'
              img.style.height = '100%'
              img.style.objectFit = 'contain'
              
              if (videoRef.current.parentElement) {
                const container = videoRef.current.parentElement
                const oldImg = container.querySelector('img')
                if (oldImg) oldImg.remove()
                container.appendChild(img)
              }
            }
          }
        }
        // 兼容旧的Blob格式
        else if (lastMessage.data instanceof Blob) {
          const videoBlob = new Blob([lastMessage.data], { type: 'video/mp4' })
          const videoUrl = URL.createObjectURL(videoBlob)
          if (videoRef.current) {
            videoRef.current.src = videoUrl
            videoRef.current.play().catch(() => {})
          }
        }
      } catch (e) {
        console.warn('解析屏幕数据失败:', e)
      }
    }
  }, [lastMessage])

  useEffect(() => {
    if (error) {
      message.error(error)
      setTimeout(() => dispatch(clearAIState()), 3000)
    }
  }, [error, dispatch])

  const handleBack = () => navigate('/')

  const handleDeviceChange = (deviceId: string) => dispatch(selectDevice(deviceId))

  const handleExecute = () => {
    if (!selectedDevice) {
      message.warning('请先选择设备')
      return
    }
    if (!command.trim()) {
      message.warning('请输入指令')
      return
    }

    dispatch(
      executeNLCommand({
        deviceId: selectedDevice,
        command: command.trim(),
      })
    )
      .unwrap()
      .then(() => message.success('指令执行成功'))
      .catch((err) => message.error(`执行失败: ${err}`))
  }

  const handleBatchOpen = () => setBatchModalVisible(true)

  const handleBatchClose = () => {
    setBatchModalVisible(false)
    setSelectedDevices([])
    setBatchCommands('')
  }

  const handleBatchExecute = () => {
    if (selectedDevices.length === 0) {
      message.warning('请选择至少一个设备')
      return
    }
    if (!batchCommands.trim()) {
      message.warning('请输入批量指令')
      return
    }

    const commands = selectedDevices.map((deviceId) => ({
      deviceId,
      command: batchCommands.trim(),
    }))

    dispatch(executeBatchCommand(commands))
      .unwrap()
      .then(() => {
        message.success('批量指令执行成功')
        handleBatchClose()
      })
      .catch((err) => message.error(`批量执行失败: ${err}`))
  }

  const handleClearHistory = () => {
    dispatch(clearHistory())
    message.success('历史记录已清空')
  }

  const deviceOptions = devices
    .filter((device) => device.status === 'connected')
    .map((device) => ({
      label: `${device.device_id} (${device.name || '未知设备'})`,
      value: device.device_id,
    }))

  const batchDeviceOptions = devices
    .filter((device) => device.status === 'connected')
    .map((device) => (
      <Checkbox key={device.device_id} value={device.device_id}>
        {device.device_id} ({device.name || '未知设备'})
      </Checkbox>
    ))

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
          <Title level={4} style={{ margin: 0 }}>AI智能控制</Title>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={handleBack}>
              返回设备列表
            </Button>
            <Button icon={<BlockOutlined />} onClick={handleBatchOpen}>
              批量操作
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
                  }}
                >
                  {!selectedDevice ? (
                    <Text type="warning" style={{ color: '#fff' }}>
                      请选择设备以查看实时画面
                    </Text>
                  ) : !isConnected ? (
                    <Text type="secondary" style={{ color: '#999' }}>
                      正在建立屏幕连接...
                    </Text>
                  ) : (
                    <video
                      ref={videoRef}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                      }}
                      autoPlay
                      muted
                      playsInline
                    />
                  )}
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
                        type={isConnected ? 'success' : 'danger'}
                        style={{ color: isConnected ? '#52c41a' : '#ff4d4f', fontSize: 12 }}
                      >
                        {isConnected ? '已连接' : '未连接'}
                      </Text>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Col>

          {/* 右侧：控制区域 */}
          <Col xs={24} lg={15} style={{ paddingLeft: 12, borderLeft: '1px solid #e8e8e8', height: '100%', overflow: 'auto' }}>
            <Tabs 
              defaultActiveKey="single" 
              style={{ height: '100%' }}
              items={[
                {
                  key: 'single',
                  label: '单设备控制',
                  children: (
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
                        <Text strong>自然语言指令：</Text>
                        <TextArea
                          placeholder="例如：打开小红书，搜索美食推荐，点赞第一个内容"
                          value={command}
                          onChange={(e) => setCommand(e.target.value)}
                          rows={6}
                          style={{ marginTop: 8 }}
                        />

                        <div style={{ textAlign: 'right', marginTop: 12 }}>
                          <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={handleExecute}
                            loading={executing}
                            disabled={!selectedDevice || executing}
                          >
                            执行指令
                          </Button>
                        </div>
                      </div>

                      {result && (
                        <div>
                          <Divider>执行结果</Divider>
                          <Card>
                            <pre
                              style={{
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-all',
                                maxHeight: '400px',
                                overflow: 'auto',
                              }}
                            >
                              {JSON.stringify(result, null, 2)}
                            </pre>
                          </Card>
                        </div>
                      )}
                    </Space>
                  )
                },
                {
                  key: 'history',
                  label: '操作历史',
                  children: (
                    <>
                      <div style={{ textAlign: 'right', marginBottom: 16 }}>
                        <Button icon={<ClearOutlined />} onClick={handleClearHistory} disabled={history.length === 0}>
                          清空历史
                        </Button>
                      </div>

                      {history.length === 0 ? (
                        <Alert message="暂无操作历史" type="info" showIcon style={{ textAlign: 'center' }} />
                      ) : (
                        <List
                          dataSource={history}
                          renderItem={(item) => (
                            <List.Item>
                              <Card>
                                <div style={{ marginBottom: 8 }}>
                                  <Text strong>设备ID：</Text>
                                  {item.deviceId}
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                  <Text strong>指令：</Text>
                                  {item.command}
                                </div>
                                <div style={{ marginBottom: 8 }}>
                                  <Text strong>执行时间：</Text>
                                  {new Date(item.timestamp).toLocaleString()}
                                </div>
                                <div>
                                  <Text strong>执行结果：</Text>
                                  <pre
                                    style={{
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-all',
                                      maxHeight: '200px',
                                      overflow: 'auto',
                                      marginTop: 8,
                                    }}
                                  >
                                    {JSON.stringify(item.result, null, 2)}
                                  </pre>
                                </div>
                              </Card>
                            </List.Item>
                          )}
                        />
                      )}
                    </>
                  )
                }
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Modal
        title="批量操作"
        open={batchModalVisible}
        onOk={handleBatchExecute}
        onCancel={handleBatchClose}
        okText="执行"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>选择设备：</Text>
            <div style={{ marginTop: 8 }}>
              <Checkbox.Group
                value={selectedDevices}
                onChange={(values) => setSelectedDevices(values as string[])}
              >
                <Space direction="vertical">{batchDeviceOptions}</Space>
              </Checkbox.Group>
            </div>
          </div>

          <div>
            <Text strong>批量指令：</Text>
            <TextArea
              rows={4}
              placeholder="输入要对所选设备执行的指令"
              value={batchCommands}
              onChange={(e) => setBatchCommands(e.target.value)}
              style={{ marginTop: 8 }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  )
}

export default AIControl
