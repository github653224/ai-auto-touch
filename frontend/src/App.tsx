import { Layout, Menu, Typography, Divider } from 'antd'
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import { 
  MobileOutlined, 
  MonitorOutlined, 
  RobotOutlined,
  HistoryOutlined,
  SettingOutlined
} from '@ant-design/icons'

// 页面组件
import DeviceManager from './pages/DeviceManager'
import ScreenDisplay from './pages/ScreenDisplay'
import AIControl from './pages/AIControl'
import OperationHistory from './pages/OperationHistory'
import SystemSettings from './pages/SystemSettings'

const { Header, Sider, Content } = Layout
const { Title } = Typography

const App = () => {
  const navigate = useNavigate()
  const location = useLocation()
  
  // 根据当前路由高亮菜单项
  const getSelectedKey = () => {
    if (location.pathname.startsWith('/screen')) return '/screen'
    if (location.pathname.startsWith('/ai')) return '/ai'
    if (location.pathname.startsWith('/history')) return '/history'
    if (location.pathname.startsWith('/settings')) return '/settings'
    return '/' // 默认选中设备管理
  }
  const selectedKey = getSelectedKey()
  
  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider width={200} theme="light">
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Title level={4}>AI 自动化平台</Title>
        </div>
        <Divider style={{ margin: 0 }} />
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          onClick={({ key }) => {
            navigate(key)
          }}
          items={[
            {
              key: '/',
              icon: <MobileOutlined />,
              label: <Link to="/">设备管理</Link>,
            },
            {
              key: '/screen',
              icon: <MonitorOutlined />,
              label: <Link to="/screen">屏幕显示</Link>,
            },
            {
              key: '/ai',
              icon: <RobotOutlined />,
              label: <Link to="/ai">AI智能控制</Link>,
            },
            {
              key: '/history',
              icon: <HistoryOutlined />,
              label: <Link to="/history">操作历史</Link>,
            },
            {
              key: '/settings',
              icon: <SettingOutlined />,
              label: <Link to="/settings">系统设置</Link>,
            },
          ]}
        />
      </Sider>
      <Layout style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header style={{ background: '#fff', padding: '0 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexShrink: 0 }}>
          <Title level={5} style={{ margin: 0, lineHeight: '64px' }}>
            AI 驱动设备自动化平台
          </Title>
        </Header>
        <Content style={{ 
          margin: '0 16px 16px 16px', 
          padding: 16, 
          background: '#fff', 
          flex: 1,
          overflow: 'auto'
        }}>
          <Routes>
            <Route path="/" element={<DeviceManager />} />
            <Route path="/screen" element={<ScreenDisplay />} />
            <Route path="/ai" element={<AIControl />} />
            <Route path="/history" element={<OperationHistory />} />
            <Route path="/settings" element={<SystemSettings />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App

