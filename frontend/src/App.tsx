import { Layout, Menu, Typography, Divider } from 'antd'
import { Routes, Route, Link, useNavigate } from 'react-router-dom'
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

const { Header, Sider, Content } = Layout
const { Title } = Typography

const App = () => {
  const navigate = useNavigate()
  
  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider width={200} theme="light">
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <Title level={4}>群控手机平台</Title>
        </div>
        <Divider style={{ margin: 0 }} />
        <Menu
          mode="inline"
          defaultSelectedKeys={['1']}
          onClick={({ key }) => {
            navigate(key)
          }}
        >
          <Menu.Item key="/" icon={<MobileOutlined />}>
            <Link to="/">设备管理</Link>
          </Menu.Item>
          <Menu.Item key="/screen" icon={<MonitorOutlined />}>
            <Link to="/screen">屏幕显示</Link>
          </Menu.Item>
          <Menu.Item key="/ai" icon={<RobotOutlined />}>
            <Link to="/ai">AI智能控制</Link>
          </Menu.Item>
          <Menu.Item key="/history" icon={<HistoryOutlined />}>
            <Link to="/history">操作历史</Link>
          </Menu.Item>
          <Menu.Item key="/settings" icon={<SettingOutlined />}>
            <Link to="/settings">系统设置</Link>
          </Menu.Item>
        </Menu>
      </Sider>
      <Layout style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header style={{ background: '#fff', padding: '0 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', flexShrink: 0 }}>
          <Title level={5} style={{ margin: 0, lineHeight: '64px' }}>
            智能群控系统
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
            <Route path="/history" element={<div>操作历史页面</div>} />
            <Route path="/settings" element={<div>系统设置页面</div>} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

export default App

