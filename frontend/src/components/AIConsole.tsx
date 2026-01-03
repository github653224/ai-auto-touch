import React, { useEffect, useRef, useState } from 'react'
import { Button, Space, Typography, Tag, Tooltip } from 'antd'
import { ClearOutlined, DownloadOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons'
import './AIConsole.css'

const { Text } = Typography

interface AILogEntry {
  id: string
  device_id: string
  log_type: string
  message: string
  timestamp: number
  data?: any
}

interface AIConsoleProps {
  logs: AILogEntry[]
  connected: boolean
  onClear: () => void
  deviceId?: string
}

const AIConsole: React.FC<AIConsoleProps> = ({ logs, connected, onClear, deviceId }) => {
  const consoleRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)

  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      console.log('🔄 自动滚动到底部，当前日志数:', logs.length)
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // 监听滚动事件，如果用户手动滚动到非底部，则停止自动滚动
  const handleScroll = () => {
    if (consoleRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = consoleRef.current
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
      setAutoScroll(isAtBottom)
    }
  }

  // 获取日志类型的样式配置
  const getLogTypeConfig = (logType: string) => {
    switch (logType) {
      case 'step':
        return { 
          color: '#1890ff', 
          prefix: '[STEP]', 
          className: 'log-step' 
        }
      case 'model_request':
        return { 
          color: '#fa8c16', 
          prefix: '[REQ]', 
          className: 'log-request' 
        }
      case 'model_response':
        return { 
          color: '#52c41a', 
          prefix: '[RES]', 
          className: 'log-response' 
        }
      case 'action':
        return { 
          color: '#722ed1', 
          prefix: '[ACT]', 
          className: 'log-action' 
        }
      case 'error':
        return { 
          color: '#ff4d4f', 
          prefix: '[ERR]', 
          className: 'log-error' 
        }
      default:
        return { 
          color: '#8c8c8c', 
          prefix: '[INFO]', 
          className: 'log-info' 
        }
    }
  }

  // 格式化时间戳
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + '.' + String(date.getMilliseconds()).padStart(3, '0')
  }

  // 导出日志
  const exportLogs = () => {
    const logText = logs.map(log => {
      const config = getLogTypeConfig(log.log_type)
      const timestamp = formatTimestamp(log.timestamp)
      return `[${timestamp}] ${config.prefix} ${log.message}`
    }).join('\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-logs-${deviceId || 'unknown'}-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // 切换全屏
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  return (
    <div className={`ai-console ${isFullscreen ? 'ai-console-fullscreen' : ''}`}>
      {/* 控制台头部 */}
      <div className="ai-console-header">
        <div className="ai-console-title">
          <Space>
            <span className="ai-console-icon">⚡</span>
            <Text strong style={{ color: '#fff' }}>AI 智能控制台</Text>
            <Tag color={connected ? 'green' : 'red'}>
              {connected ? '已连接' : '未连接'}
            </Tag>
            {logs.length > 0 && (
              <Tag color="blue">{logs.length} 条日志</Tag>
            )}
          </Space>
        </div>
        
        <div className="ai-console-controls">
          <Space size="small">
            <Tooltip title="导出日志">
              <Button 
                type="text" 
                icon={<DownloadOutlined />} 
                size="small"
                onClick={exportLogs}
                disabled={logs.length === 0}
                style={{ color: '#fff' }}
              />
            </Tooltip>
            <Tooltip title={isFullscreen ? '退出全屏' : '全屏显示'}>
              <Button 
                type="text" 
                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />} 
                size="small"
                onClick={toggleFullscreen}
                style={{ color: '#fff' }}
              />
            </Tooltip>
            <Tooltip title="清空日志">
              <Button 
                type="text" 
                icon={<ClearOutlined />} 
                size="small"
                onClick={onClear}
                disabled={logs.length === 0}
                style={{ color: '#fff' }}
              />
            </Tooltip>
          </Space>
        </div>
      </div>

      {/* 控制台内容 */}
      <div 
        className="ai-console-content"
        ref={consoleRef}
        onScroll={handleScroll}
      >
        {logs.length === 0 ? (
          <div className="ai-console-empty">
            <div className="ai-console-prompt">
              <span className="ai-console-cursor">█</span>
            </div>
            <div className="ai-console-welcome">
              {deviceId ? (
                <>
                  <div>AI 智能控制台已就绪</div>
                  <div>设备: {deviceId}</div>
                  <div>等待指令执行...</div>
                </>
              ) : (
                <div>请选择设备以开始 AI 控制</div>
              )}
            </div>
          </div>
        ) : (
          <>
            {logs.map((log) => {
              const config = getLogTypeConfig(log.log_type)
              const timestamp = formatTimestamp(log.timestamp)
              
              return (
                <div key={log.id} className={`ai-console-line ${config.className}`}>
                  <span className="ai-console-timestamp">[{timestamp}]</span>
                  <span className="ai-console-prefix" style={{ color: config.color }}>
                    {config.prefix}
                  </span>
                  <span className="ai-console-message">{log.message}</span>
                  {log.data && Object.keys(log.data).length > 0 && (
                    <details className="ai-console-details">
                      <summary>详细信息</summary>
                      <pre className="ai-console-data">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )
            })}
            
            {/* 当前输入提示符 */}
            <div className="ai-console-line ai-console-current">
              <span className="ai-console-prompt">
                <span style={{ color: '#52c41a' }}>AI@{deviceId || 'device'}</span>
                <span style={{ color: '#fff' }}>:~$ </span>
                <span className="ai-console-cursor">█</span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* 自动滚动指示器 */}
      {!autoScroll && logs.length > 0 && (
        <div className="ai-console-scroll-indicator">
          <Button 
            type="primary" 
            size="small" 
            onClick={() => {
              setAutoScroll(true)
              if (consoleRef.current) {
                consoleRef.current.scrollTop = consoleRef.current.scrollHeight
              }
            }}
          >
            滚动到底部 ({logs.length - Math.floor(consoleRef.current?.scrollTop || 0 / 20)} 条新日志)
          </Button>
        </div>
      )}
    </div>
  )
}

export default AIConsole