import { useEffect, useRef, useState, useCallback } from 'react'

interface AILogMessage {
  type: 'ai_log' | 'connected' | 'heartbeat'
  log_type?: 'info' | 'step' | 'model_request' | 'model_response' | 'action' | 'error'
  message?: string
  device_id?: string
  timestamp?: number
  data?: any
}

interface AILogEntry {
  id: string
  timestamp: number
  log_type: string
  message: string
  data?: any
}

interface UseAILogsWebSocketResult {
  logs: AILogEntry[]
  connected: boolean
  clearLogs: () => void
  connect: () => void
  disconnect: () => void
}

export function useAILogsWebSocket(deviceId: string | null): UseAILogsWebSocketResult {
  const [logs, setLogs] = useState<AILogEntry[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const wsUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'
  const url = deviceId ? `${wsUrl.replace('http', 'ws')}/api/v1/ws/ai-logs/${deviceId}` : null

  const addLog = useCallback((logEntry: AILogEntry) => {
    setLogs(prev => [...prev, logEntry])
  }, [])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect')
      wsRef.current = null
    }
    
    setConnected(false)
    reconnectAttempts.current = 0
  }, [])

  const connect = useCallback(() => {
    if (!url || wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    disconnect() // 清理现有连接

    try {
      console.log('连接 AI 日志 WebSocket:', url)
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('✅ AI 日志 WebSocket 已连接')
        setConnected(true)
        reconnectAttempts.current = 0
        
        // 发送心跳
        const heartbeat = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }))
          } else {
            clearInterval(heartbeat)
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        try {
          const message: AILogMessage = JSON.parse(event.data)
          
          console.log('📨 收到 AI 日志消息:', message)
          
          if (message.type === 'ai_log' && message.log_type && message.message) {
            const logEntry: AILogEntry = {
              id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: message.timestamp || Date.now(),
              log_type: message.log_type,
              message: message.message,
              data: message.data
            }
            
            console.log('✅ 添加日志条目:', logEntry)
            addLog(logEntry)
          } else if (message.type === 'connected') {
            console.log('AI 日志连接确认:', message.message)
          } else if (message.type === 'heartbeat' || message.type === 'pong') {
            // 心跳消息，不需要处理
          } else {
            console.log('收到其他类型消息:', message)
          }
        } catch (e) {
          console.warn('解析 AI 日志消息失败:', e, event.data)
        }
      }

      ws.onerror = (error) => {
        console.error('AI 日志 WebSocket 错误:', error)
      }

      ws.onclose = (event) => {
        console.log('AI 日志 WebSocket 已关闭:', event.code, event.reason)
        setConnected(false)
        wsRef.current = null

        // 自动重连
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000)
          
          console.log(`AI 日志 WebSocket 将在 ${delay}ms 后重连 (${reconnectAttempts.current}/${maxReconnectAttempts})`)
          
          reconnectTimerRef.current = window.setTimeout(() => {
            connect()
          }, delay)
        }
      }

    } catch (error) {
      console.error('创建 AI 日志 WebSocket 失败:', error)
    }
  }, [url, addLog, disconnect])

  // 当 deviceId 变化时，重新连接
  useEffect(() => {
    if (deviceId && url) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [deviceId, url, connect, disconnect])

  return {
    logs,
    connected,
    clearLogs,
    connect,
    disconnect
  }
}