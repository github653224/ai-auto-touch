import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  Card,
  List,
  Button,
  Empty,
  Tag,
  Space,
  Typography,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Statistic,
  Divider
} from 'antd'
import {
  DeleteOutlined,
  SearchOutlined,
  DownloadOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { RootState, AppDispatch } from '../store'
import { clearHistory } from '../features/aiSlice'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { RangePicker } = DatePicker

interface OperationRecord {
  id: string
  deviceId: string
  deviceName?: string
  action: string
  command?: string
  result?: any
  timestamp: number
  status: 'success' | 'error' | 'pending'
}

const OperationHistory = () => {
  const dispatch = useDispatch<AppDispatch>()
  const { history } = useSelector((state: RootState) => state.ai)
  const { devices } = useSelector((state: RootState) => state.devices)
  
  const [searchText, setSearchText] = useState('')
  const [filterDevice, setFilterDevice] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null])
  
  // 转换历史记录格式
  const operationRecords: OperationRecord[] = history.map((item, index) => ({
    id: `${item.timestamp}-${index}`,
    deviceId: item.deviceId || 'unknown',
    deviceName: devices.find(d => d.device_id === item.deviceId)?.name,
    action: 'AI指令执行',
    command: item.command,
    result: item.result,
    timestamp: item.timestamp,
    status: item.result?.success === false ? 'error' : 'success'
  }))
  
  // 过滤记录
  const filteredRecords = operationRecords.filter(record => {
    // 搜索过滤
    if (searchText && !record.command?.toLowerCase().includes(searchText.toLowerCase())) {
      return false
    }
    
    // 设备过滤
    if (filterDevice !== 'all' && record.deviceId !== filterDevice) {
      return false
    }
    
    // 状态过滤
    if (filterStatus !== 'all' && record.status !== filterStatus) {
      return false
    }
    
    // 日期范围过滤
    if (dateRange[0] && dateRange[1]) {
      const recordDate = dayjs(record.timestamp)
      if (recordDate.isBefore(dateRange[0]) || recordDate.isAfter(dateRange[1])) {
        return false
      }
    }
    
    return true
  })
  
  // 统计数据
  const stats = {
    total: operationRecords.length,
    success: operationRecords.filter(r => r.status === 'success').length,
    error: operationRecords.filter(r => r.status === 'error').length,
    today: operationRecords.filter(r => dayjs(r.timestamp).isAfter(dayjs().startOf('day'))).length
  }
  
  // 清空历史
  const handleClearHistory = () => {
    dispatch(clearHistory())
  }
  
  // 导出历史
  const handleExportHistory = () => {
    const dataStr = JSON.stringify(operationRecords, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `operation-history-${dayjs().format('YYYY-MM-DD-HHmmss')}.json`
    link.click()
    URL.revokeObjectURL(url)
  }
  
  // 设备选项
  const deviceOptions = [
    { label: '全部设备', value: 'all' },
    ...devices.map(d => ({
      label: `${d.name || d.device_id} (${d.device_id})`,
      value: d.device_id
    }))
  ]
  
  return (
    <div style={{ padding: '24px', height: '100%', overflow: 'auto' }}>
      <Card>
        <Title level={3}>操作历史</Title>
        
        {/* 统计卡片 */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title="总操作数" value={stats.total} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="成功" value={stats.success} valueStyle={{ color: '#3f8600' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="失败" value={stats.error} valueStyle={{ color: '#cf1322' }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic title="今日操作" value={stats.today} valueStyle={{ color: '#1890ff' }} />
            </Card>
          </Col>
        </Row>
        
        <Divider />
        
        {/* 过滤器 */}
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="middle">
          <Row gutter={16}>
            <Col span={8}>
              <Input
                placeholder="搜索指令内容"
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </Col>
            <Col span={6}>
              <Select
                style={{ width: '100%' }}
                placeholder="选择设备"
                value={filterDevice}
                onChange={setFilterDevice}
                options={deviceOptions}
              />
            </Col>
            <Col span={6}>
              <Select
                style={{ width: '100%' }}
                placeholder="选择状态"
                value={filterStatus}
                onChange={setFilterStatus}
                options={[
                  { label: '全部状态', value: 'all' },
                  { label: '成功', value: 'success' },
                  { label: '失败', value: 'error' }
                ]}
              />
            </Col>
            <Col span={4}>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setSearchText('')
                  setFilterDevice('all')
                  setFilterStatus('all')
                  setDateRange([null, null])
                }}
              >
                重置
              </Button>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <RangePicker
                style={{ width: '100%' }}
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
                showTime
                format="YYYY-MM-DD HH:mm:ss"
              />
            </Col>
            <Col span={12}>
              <Space>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExportHistory}
                  disabled={operationRecords.length === 0}
                >
                  导出历史
                </Button>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  onClick={handleClearHistory}
                  disabled={operationRecords.length === 0}
                >
                  清空历史
                </Button>
              </Space>
            </Col>
          </Row>
        </Space>
        
        <Divider />
        
        {/* 历史记录列表 */}
        {filteredRecords.length === 0 ? (
          <Empty
            description={operationRecords.length === 0 ? '暂无操作历史' : '没有符合条件的记录'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <List
            dataSource={filteredRecords}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条记录`
            }}
            renderItem={(record) => (
              <List.Item>
                <Card style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space>
                        <Tag color={record.status === 'success' ? 'green' : 'red'}>
                          {record.status === 'success' ? '成功' : '失败'}
                        </Tag>
                        <Tag color="blue">{record.action}</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(record.timestamp).format('YYYY-MM-DD HH:mm:ss')}
                        </Text>
                      </Space>
                    </div>
                    
                    <div>
                      <Text strong>设备：</Text>
                      <Text>{record.deviceName || record.deviceId}</Text>
                    </div>
                    
                    {record.command && (
                      <div>
                        <Text strong>指令：</Text>
                        <Text code>{record.command}</Text>
                      </div>
                    )}
                    
                    {record.result && (
                      <div>
                        <Text strong>结果：</Text>
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: '200px',
                            overflow: 'auto',
                            marginTop: 8,
                            padding: 8,
                            background: '#f5f5f5',
                            borderRadius: 4
                          }}
                        >
                          {JSON.stringify(record.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </Space>
                </Card>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  )
}

export default OperationHistory
