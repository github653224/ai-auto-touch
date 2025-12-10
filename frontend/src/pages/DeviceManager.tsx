import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { AppDispatch, RootState } from '../store'
import { 
  fetchDevices, 
  scanDevices, 
  connectDevice, 
  disconnectDevice,
  selectDevice,
  clearError
} from '../features/deviceSlice'
import { 
  Card, 
  Button, 
  Table, 
  Tag, 
  Space, 
  message, 
  Spin, 
  Alert 
} from 'antd'
import { 
  ReloadOutlined, 
  LinkOutlined, 
  DisconnectOutlined,
  MonitorOutlined,
  RobotOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const DeviceManager = () => {
  const dispatch = useDispatch<AppDispatch>()
  const navigate = useNavigate()
  const { devices, loading, error } = useSelector((state: RootState) => state.devices)
  
  // 初始化加载设备列表
  useEffect(() => {
    dispatch(fetchDevices())
  }, [dispatch])
  
  // 处理错误提示
  useEffect(() => {
    if (error) {
      message.error(error)
      // 3秒后清除错误
      setTimeout(() => {
        dispatch(clearError())
      }, 3000)
    }
  }, [error, dispatch])
  
  // 扫描设备
  const handleScan = () => {
    dispatch(scanDevices())
      .unwrap()
      .then(() => {
        message.success('扫描设备成功')
      })
      .catch((err) => {
        message.error(`扫描失败: ${err}`)
      })
  }
  
  // 连接设备
  const handleConnect = (deviceId: string) => {
    dispatch(connectDevice(deviceId))
      .unwrap()
      .then(() => {
        message.success(`设备 ${deviceId} 连接成功`)
      })
      .catch((err) => {
        message.error(`连接失败: ${err}`)
      })
  }
  
  // 断开设备
  const handleDisconnect = (deviceId: string) => {
    dispatch(disconnectDevice(deviceId))
      .unwrap()
      .then(() => {
        message.success(`设备 ${deviceId} 断开成功`)
      })
      .catch((err) => {
        message.error(`断开失败: ${err}`)
      })
  }
  
  // 查看屏幕
  const handleViewScreen = (deviceId: string) => {
    dispatch(selectDevice(deviceId))
    navigate('/screen')
  }
  
  // AI控制
  const handleAIControl = (deviceId: string) => {
    dispatch(selectDevice(deviceId))
    navigate('/ai')
  }
  
  // 表格列配置
  const columns = [
    {
      title: '设备ID',
      dataIndex: 'device_id',
      key: 'device_id',
      width: 200,
    },
    {
      title: '设备名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => name || '未知设备',
    },
    {
      title: '设备型号',
      dataIndex: 'model',
      key: 'model',
      render: (model: string) => model || '未知型号',
    },
    {
      title: 'Android版本',
      dataIndex: 'android_version',
      key: 'android_version',
      render: (version: string) => version || '未知版本',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'connected' ? 'success' : 'error'}>
          {status === 'connected' ? '已连接' : '未连接'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status !== 'connected' ? (
            <Button 
              type="primary" 
              icon={<LinkOutlined />} 
              size="small"
              onClick={() => handleConnect(record.device_id)}
            >
              连接
            </Button>
          ) : (
             <Button 
               danger 
               icon={<DisconnectOutlined />} 
               size="small"
               onClick={() => handleDisconnect(record.device_id)}
             >
               断开
             </Button>
          )}
          <Button 
            icon={<MonitorOutlined />} 
            size="small"
            disabled={record.status !== 'connected'}
            onClick={() => handleViewScreen(record.device_id)}
          >
            查看屏幕
          </Button>
          <Button 
            icon={<RobotOutlined />} 
            size="small"
            disabled={record.status !== 'connected'}
            onClick={() => handleAIControl(record.device_id)}
          >
            AI控制
          </Button>
        </Space>
      ),
    },
  ]
  
  return (
    <div>
      <Card title="设备管理" extra={
        <Button 
          type="primary" 
          icon={<ReloadOutlined />}
          onClick={handleScan}
          loading={loading}
        >
          扫描设备
        </Button>
      }>
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        
        <Spin spinning={loading}>
          <Table
            columns={columns}
            dataSource={devices}
            rowKey="device_id"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 'max-content' }}
          />
        </Spin>
      </Card>
    </div>
  )
}

export default DeviceManager

