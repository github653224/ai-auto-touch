import { useState, useEffect } from 'react'
import {
  Card,
  Form,
  InputNumber,
  Switch,
  Button,
  Space,
  Typography,
  Divider,
  message,
  Select,
  Slider,
  Row,
  Col,
  Alert
} from 'antd'
import {
  SaveOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons'

const { Title, Paragraph } = Typography

interface SystemSettingsData {
  // 连接设置
  autoReconnect: boolean
  reconnectInterval: number
  connectionTimeout: number
  
  // 截图设置
  screenshotInterval: number
  screenshotQuality: number
  screenshotFormat: 'png' | 'jpeg'
  
  // 性能设置
  maxConcurrentConnections: number
  enableHardwareAcceleration: boolean
  
  // 日志设置
  enableLog: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  
  // AI设置
  aiTimeout: number
  aiMaxRetries: number
  
  // 其他设置
  theme: 'light' | 'dark' | 'auto'
  language: 'zh-CN' | 'en-US'
}

const defaultSettings: SystemSettingsData = {
  autoReconnect: true,
  reconnectInterval: 3000,
  connectionTimeout: 10000,
  screenshotInterval: 100,
  screenshotQuality: 80,
  screenshotFormat: 'jpeg',
  maxConcurrentConnections: 10,
  enableHardwareAcceleration: true,
  enableLog: true,
  logLevel: 'info',
  aiTimeout: 30000,
  aiMaxRetries: 3,
  theme: 'light',
  language: 'zh-CN'
}

const SystemSettings = () => {
  const [form] = Form.useForm()
  const [settings, setSettings] = useState<SystemSettingsData>(defaultSettings)
  const [hasChanges, setHasChanges] = useState(false)
  
  // 从 localStorage 加载设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('systemSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings({ ...defaultSettings, ...parsed })
        form.setFieldsValue({ ...defaultSettings, ...parsed })
      } catch (e) {
        console.error('加载设置失败:', e)
      }
    }
  }, [form])
  
  // 保存设置
  const handleSave = () => {
    form.validateFields().then(values => {
      const newSettings = { ...settings, ...values }
      setSettings(newSettings)
      localStorage.setItem('systemSettings', JSON.stringify(newSettings))
      setHasChanges(false)
      message.success('设置已保存')
    }).catch(() => {
      message.error('保存失败，请检查输入')
    })
  }
  
  // 重置为默认设置
  const handleReset = () => {
    setSettings(defaultSettings)
    form.setFieldsValue(defaultSettings)
    setHasChanges(true)
    message.info('已重置为默认设置，点击保存以应用')
  }
  
  // 表单值变化
  const handleValuesChange = () => {
    setHasChanges(true)
  }
  
  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <Card>
        <Title level={3}>
          <SettingOutlined /> 系统设置
        </Title>
        <Paragraph type="secondary">
          配置系统的各项参数，设置会保存在浏览器本地存储中
        </Paragraph>
        
        {hasChanges && (
          <Alert
            message="有未保存的更改"
            description="您修改了设置但尚未保存，请点击保存按钮以应用更改"
            type="warning"
            showIcon
            closable
            style={{ marginBottom: 16 }}
          />
        )}
        
        <Form
          form={form}
          layout="vertical"
          initialValues={settings}
          onValuesChange={handleValuesChange}
        >
          {/* 连接设置 */}
          <Card type="inner" title="连接设置" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="自动重连"
                  name="autoReconnect"
                  valuePropName="checked"
                  extra="连接断开时自动尝试重新连接"
                >
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="重连间隔（毫秒）"
                  name="reconnectInterval"
                  rules={[{ required: true, type: 'number', min: 1000, max: 30000 }]}
                  extra="自动重连的时间间隔"
                >
                  <InputNumber style={{ width: '100%' }} step={1000} />
                </Form.Item>
              </Col>
            </Row>
            
            <Form.Item
              label="连接超时（毫秒）"
              name="connectionTimeout"
              rules={[{ required: true, type: 'number', min: 5000, max: 60000 }]}
              extra="连接建立的最大等待时间"
            >
              <InputNumber style={{ width: '100%' }} step={1000} />
            </Form.Item>
          </Card>
          
          {/* 截图设置 */}
          <Card type="inner" title="截图设置" style={{ marginBottom: 16 }}>
            <Form.Item
              label="截图间隔（毫秒）"
              name="screenshotInterval"
              rules={[{ required: true, type: 'number', min: 50, max: 1000 }]}
              extra="截图刷新间隔，值越小越流畅但占用更多资源"
            >
              <Slider
                min={50}
                max={1000}
                step={50}
                marks={{
                  50: '50ms',
                  100: '100ms',
                  500: '500ms',
                  1000: '1s'
                }}
              />
            </Form.Item>
            
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="图片质量"
                  name="screenshotQuality"
                  rules={[{ required: true, type: 'number', min: 1, max: 100 }]}
                  extra="值越高画质越好但传输数据越大"
                >
                  <Slider min={1} max={100} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="图片格式"
                  name="screenshotFormat"
                  extra="JPEG 文件更小，PNG 质量更好"
                >
                  <Select
                    options={[
                      { label: 'JPEG（推荐）', value: 'jpeg' },
                      { label: 'PNG', value: 'png' }
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          
          {/* 性能设置 */}
          <Card type="inner" title="性能设置" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="最大并发连接数"
                  name="maxConcurrentConnections"
                  rules={[{ required: true, type: 'number', min: 1, max: 100 }]}
                  extra="同时连接的最大设备数量"
                >
                  <InputNumber style={{ width: '100%' }} min={1} max={100} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="启用硬件加速"
                  name="enableHardwareAcceleration"
                  valuePropName="checked"
                  extra="使用 GPU 加速视频解码（如果支持）"
                >
                  <Switch />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          
          {/* 日志设置 */}
          <Card type="inner" title="日志设置" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="启用日志"
                  name="enableLog"
                  valuePropName="checked"
                  extra="在浏览器控制台输出日志信息"
                >
                  <Switch />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="日志级别"
                  name="logLevel"
                  extra="控制输出的日志详细程度"
                >
                  <Select
                    options={[
                      { label: 'Debug（最详细）', value: 'debug' },
                      { label: 'Info（推荐）', value: 'info' },
                      { label: 'Warning', value: 'warn' },
                      { label: 'Error（仅错误）', value: 'error' }
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          
          {/* AI 设置 */}
          <Card type="inner" title="AI 设置" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="AI 超时时间（毫秒）"
                  name="aiTimeout"
                  rules={[{ required: true, type: 'number', min: 5000, max: 120000 }]}
                  extra="AI 指令执行的最大等待时间"
                >
                  <InputNumber style={{ width: '100%' }} step={5000} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="最大重试次数"
                  name="aiMaxRetries"
                  rules={[{ required: true, type: 'number', min: 0, max: 10 }]}
                  extra="AI 指令失败后的重试次数"
                >
                  <InputNumber style={{ width: '100%' }} min={0} max={10} />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          
          {/* 界面设置 */}
          <Card type="inner" title="界面设置" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="主题"
                  name="theme"
                  extra="选择界面主题（暂未实现）"
                >
                  <Select
                    options={[
                      { label: '浅色', value: 'light' },
                      { label: '深色', value: 'dark' },
                      { label: '跟随系统', value: 'auto' }
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="语言"
                  name="language"
                  extra="选择界面语言（暂未实现）"
                >
                  <Select
                    options={[
                      { label: '简体中文', value: 'zh-CN' },
                      { label: 'English', value: 'en-US' }
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
          </Card>
          
          <Divider />
          
          {/* 操作按钮 */}
          <Space>
            <Button
              type="primary"
              icon={<SaveOutlined />}
              onClick={handleSave}
              disabled={!hasChanges}
            >
              保存设置
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleReset}
            >
              恢复默认
            </Button>
          </Space>
        </Form>
      </Card>
    </div>
  )
}

export default SystemSettings
