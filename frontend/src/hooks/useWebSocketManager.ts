import { useEffect, useRef, useState, useCallback } from 'react'

interface WebSocketMessage {
  type: string
  data?: any
  frame?: number
  message?: string
}

type MessageHandler = (data: WebSocketMessage) => void

class WebSocketManager {
  private ws: WebSocket | null = null
  private url: string | null = null
  private reconnectTimer: number | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private reconnectInterval = 3000
  private messageHandlers = new Set<MessageHandler>()
  private pingInterval: number | null = null
  private isManualClose = false

  connect(url: string) {
    // 如果已经连接到相同的URL，不重复连接
    if (this.ws && this.url === url && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket已连接到:', url)
      return
    }

    // 如果URL改变，先关闭旧连接
    if (this.url !== url && this.ws) {
      this.disconnect()
    }

    this.url = url
    this.isManualClose = false
    this.reconnectAttempts = 0

    this._connect()
  }

  private _connect() {
    if (!this.url) return

    try {
      console.log('正在连接WebSocket:', this.url)
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('WebSocket连接已建立:', this.url)
        this.reconnectAttempts = 0
        this._startPing()
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('WebSocket收到消息:', data.type, data.frame ? `帧#${data.frame}` : '')
          this._notifyHandlers(data)
        } catch (e) {
          // 如果不是JSON，可能是文本消息
          console.warn('收到非JSON消息:', event.data.substring(0, 100))
        }
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error)
      }

      this.ws.onclose = (event) => {
        console.log('WebSocket连接已关闭:', event.code, event.reason)
        this._stopPing()

        // 如果不是手动关闭且还有重连次数，则重连
        if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++
          console.log(`准备重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`)
          this.reconnectTimer = window.setTimeout(() => {
            this._connect()
          }, this.reconnectInterval) as unknown as number
        }
      }
    } catch (error) {
      console.error('创建WebSocket连接失败:', error)
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        this.reconnectTimer = window.setTimeout(() => {
          this._connect()
        }, this.reconnectInterval) as unknown as number
      }
    }
  }

  disconnect() {
    this.isManualClose = true
    this._stopPing()
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.ws) {
      this.ws.close(1000, 'Manual close')
      this.ws = null
    }

    this.url = null
    this.reconnectAttempts = 0
  }

  subscribe(handler: MessageHandler) {
    this.messageHandlers.add(handler)
    return () => {
      this.messageHandlers.delete(handler)
    }
  }

  private _notifyHandlers(data: WebSocketMessage) {
    this.messageHandlers.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        console.error('处理WebSocket消息失败:', error)
      }
    })
  }

  private _startPing() {
    this._stopPing()
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }))
        } catch (e) {
          console.warn('发送心跳失败:', e)
        }
      }
    }, 30000) as unknown as number // 每30秒发送一次心跳
  }

  private _stopPing() {
    if (this.pingInterval) {
      window.clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  getReadyState(): number {
    if (!this.ws) return WebSocket.CONNECTING
    return this.ws.readyState
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }
}

// 全局单例
const wsManager = new WebSocketManager()

export function useWebSocketManager(deviceId: string | null) {
  const [readyState, setReadyState] = useState<number>(WebSocket.CONNECTING)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const handlerRef = useRef<MessageHandler | null>(null)

  const wsUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'
  const url = deviceId ? `${wsUrl.replace('http', 'ws')}/api/v1/ws/screen/${deviceId}` : null

  // 连接管理
  useEffect(() => {
    if (url) {
      wsManager.connect(url)
      setReadyState(wsManager.getReadyState())
    } else {
      wsManager.disconnect()
      setReadyState(WebSocket.CLOSED)
    }

    return () => {
      // 注意：这里不自动断开，让其他组件可以继续使用连接
      // 只有在没有其他订阅者时才断开
    }
  }, [url])

  // 订阅消息
  useEffect(() => {
    const handler: MessageHandler = (data) => {
      setLastMessage(data)
    }
    handlerRef.current = handler

    const unsubscribe = wsManager.subscribe(handler)
    return unsubscribe
  }, [])

  // 定期更新readyState
  useEffect(() => {
    const interval = setInterval(() => {
      setReadyState(wsManager.getReadyState())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const sendMessage = useCallback((message: string | object) => {
    if (wsManager.isConnected()) {
      const ws = (wsManager as any).ws
      if (ws) {
        ws.send(typeof message === 'string' ? message : JSON.stringify(message))
      }
    }
  }, [])

  return {
    lastMessage,
    readyState,
    sendMessage,
    isConnected: wsManager.isConnected(),
  }
}

// 清理函数：在应用退出时调用
export function cleanupWebSocketManager() {
  wsManager.disconnect()
}

