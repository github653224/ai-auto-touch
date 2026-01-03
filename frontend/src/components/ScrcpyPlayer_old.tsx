import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { message } from 'antd'

// 使用与 API 相同的基础 URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

interface ScrcpyPlayerProps {
  deviceId: string
  maxSize?: number
  bitRate?: number
  onReady?: () => void
  onError?: (error: string) => void
}

interface VideoMetadata {
  deviceName?: string
  width?: number
  height?: number
  codec?: number
}

interface VideoPacket {
  type: 'configuration' | 'data'
  data: ArrayBuffer | Uint8Array
  keyframe?: boolean
  pts?: number
  timestamp?: number
}

export const ScrcpyPlayer = ({
  deviceId,
  maxSize = 1280,
  bitRate = 4_000_000,
  onReady,
  onError,
}: ScrcpyPlayerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const decoderRef = useRef<VideoDecoder | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // 检查浏览器是否支持 WebCodecs
  const isWebCodecsSupported = useCallback(() => {
    return typeof window !== 'undefined' && 'VideoDecoder' in window
  }, [])

  // 创建视频解码器（带配置数据）
  const createDecoderWithConfig = useCallback(async (configData: Uint8Array) => {
    if (!isWebCodecsSupported()) {
      throw new Error('当前浏览器不支持 WebCodecs API，请使用最新版 Chrome 或 Edge')
    }

    const canvas = canvasRef.current
    if (!canvas) {
      throw new Error('Canvas 元素未找到')
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('无法获取 Canvas 2D 上下文')
    }

    // 创建解码器 - 优化配置以减少延迟
    const decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        try {
          // 设置 canvas 尺寸（首次）
          if (canvas.width === 0 || canvas.height === 0) {
            canvas.width = frame.displayWidth
            canvas.height = frame.displayHeight
            console.log(`Canvas 尺寸: ${canvas.width}x${canvas.height}`)
          }
          
          ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
          frame.close()
        } catch (e) {
          console.error('渲染帧失败:', e)
        }
      },
      error: (e: Error) => {
        console.error('解码器错误:', e)
        setStatus('error')
        setErrorMessage(e.message)
        onError?.(e.message)
      },
    })

    // 配置解码器（H.264）- 使用 description 字段传入 SPS/PPS
    decoder.configure({
      codec: 'avc1.42E01E', // H.264 Baseline Profile Level 3.0
      optimizeForLatency: true, // 优化延迟而非吞吐量
      hardwareAcceleration: 'prefer-hardware', // 优先使用硬件加速
      description: configData, // 关键：传入 SPS/PPS 配置数据
    })

    return decoder
  }, [isWebCodecsSupported, onError])

  const createDecoder = useCallback(async (metadata: VideoMetadata) => {
    if (!isWebCodecsSupported()) {
      throw new Error('当前浏览器不支持 WebCodecs API，请使用最新版 Chrome 或 Edge')
    }

    const canvas = canvasRef.current
    if (!canvas) {
      throw new Error('Canvas 元素未找到')
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('无法获取 Canvas 2D 上下文')
    }

    // 设置 canvas 尺寸
    if (metadata.width && metadata.height) {
      canvas.width = metadata.width
      canvas.height = metadata.height
    }

    // 创建解码器 - 优化配置以减少延迟
    const decoder = new VideoDecoder({
      output: (frame: VideoFrame) => {
        try {
          ctx.drawImage(frame, 0, 0, canvas.width, canvas.height)
          frame.close()
        } catch (e) {
          console.error('渲染帧失败:', e)
        }
      },
      error: (e: Error) => {
        console.error('解码器错误:', e)
        setStatus('error')
        setErrorMessage(e.message)
        onError?.(e.message)
      },
    })

    // 配置解码器（H.264）- 优化延迟
    decoder.configure({
      codec: 'avc1.42E01E', // H.264 Baseline Profile Level 3.0
      optimizeForLatency: true, // 优化延迟而非吞吐量
      hardwareAcceleration: 'prefer-hardware', // 优先使用硬件加速
    })

    return decoder
  }, [isWebCodecsSupported, onError])

  // 连接设备
  useEffect(() => {
    if (!deviceId) return

    let mounted = true
    let configReceived = false
    let configData: Uint8Array | null = null  // 保存配置数据

    const connect = async () => {
      try {
        setStatus('connecting')
        setErrorMessage(null)

        // 创建 Socket.IO 连接 - 使用与 API 相同的基础 URL
        const socket = io(API_BASE_URL, {
          path: '/socket.io',
          transports: ['websocket'],
          timeout: 10000,
        })

        socketRef.current = socket

        socket.on('connect', () => {
          console.log('Socket.IO 已连接到:', API_BASE_URL)
          socket.emit('connect-device', {
            device_id: deviceId,
            maxSize,
            bitRate,
          })
        })

        socket.on('video-metadata', async (metadata: VideoMetadata) => {
          if (!mounted) return

          try {
            console.log('收到视频元数据:', metadata)
            // 先不创建解码器，等收到配置帧后再创建
            setStatus('connected')
          } catch (e: any) {
            console.error('初始化失败:', e)
            setStatus('error')
            setErrorMessage(e.message)
            onError?.(e.message)
            socket.close()
          }
        })

        socket.on('video-data', async (packet: VideoPacket) => {
          if (!mounted) return

          try {
            const data = packet.data instanceof Uint8Array 
              ? packet.data 
              : new Uint8Array(packet.data)

            if (packet.type === 'configuration') {
              // 配置帧（SPS/PPS）- 保存并用于创建解码器
              configReceived = true
              configData = data
              console.log('收到配置帧，长度:', data.length)
              
              // 使用配置数据创建解码器
              if (!decoderRef.current) {
                try {
                  const decoder = await createDecoderWithConfig(configData)
                  decoderRef.current = decoder
                  onReady?.()
                  console.log('✅ 解码器已创建并配置')
                } catch (e: any) {
                  console.error('创建解码器失败:', e)
                  setStatus('error')
                  setErrorMessage(e.message)
                  onError?.(e.message)
                }
              }
            } else if (packet.type === 'data' && configReceived && decoderRef.current) {
              // 视频数据帧
              const chunk = new EncodedVideoChunk({
                type: packet.keyframe ? 'key' : 'delta',
                timestamp: packet.pts || packet.timestamp || 0,
                data: data,
              })
              decoderRef.current.decode(chunk)
              
              // 每30帧打印一次日志
              const frameCount = (window as any).__videoFrameCount = ((window as any).__videoFrameCount || 0) + 1
              if (frameCount % 30 === 0) {
                console.log(`✅ 已解码 ${frameCount} 帧`)
              }
            }
          } catch (e) {
            console.error('解码失败:', e)
          }
        })

        socket.on('error', (error: { message?: string }) => {
          if (!mounted) return
          const msg = error?.message || 'Socket 错误'
          console.error('Socket 错误:', msg)
          setStatus('error')
          setErrorMessage(msg)
          onError?.(msg)
        })

        socket.on('disconnect', () => {
          if (!mounted) return
          console.log('Socket.IO 已断开')
          setStatus('error')
          setErrorMessage('连接已断开')
        })
      } catch (e: any) {
        if (!mounted) return
        console.error('连接失败:', e)
        setStatus('error')
        setErrorMessage(e.message)
        onError?.(e.message)
      }
    }

    connect()

    return () => {
      mounted = false
      if (decoderRef.current) {
        try {
          decoderRef.current.close()
        } catch (e) {
          console.error('关闭解码器失败:', e)
        }
        decoderRef.current = null
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
    }
  }, [deviceId, maxSize, bitRate, createDecoder, onReady, onError])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000',
        }}
      />
      {status === 'connecting' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#fff',
            textAlign: 'center',
          }}
        >
          正在连接视频流...
        </div>
      )}
      {status === 'error' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#ff4d4f',
            textAlign: 'center',
          }}
        >
          {errorMessage || '视频流错误'}
        </div>
      )}
    </div>
  )
}
