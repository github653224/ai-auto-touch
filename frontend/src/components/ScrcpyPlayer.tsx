import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { ScrcpyVideoCodecId } from '@yume-chan/scrcpy'
import {
  WebCodecsVideoDecoder,
  WebGLVideoFrameRenderer,
  BitmapVideoFrameRenderer,
} from '@yume-chan/scrcpy-decoder-webcodecs'

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

// 生成唯一 ID
let instanceCounter = 0

export const ScrcpyPlayer = ({
  deviceId,
  maxSize = 1280,
  bitRate = 4_000_000,
  onReady,
  onError,
}: ScrcpyPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const decoderRef = useRef<WebCodecsVideoDecoder | null>(null)
  const instanceIdRef = useRef<number>(++instanceCounter)
  
  // 使用 ref 存储回调函数，避免依赖问题
  const onReadyRef = useRef(onReady)
  const onErrorRef = useRef(onError)
  
  useEffect(() => {
    onReadyRef.current = onReady
    onErrorRef.current = onError
  }, [onReady, onError])
  
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [screenInfo, setScreenInfo] = useState<{ width: number; height: number } | null>(null)

  const log = useCallback((msg: string, ...args: any[]) => {
    console.log(`[ScrcpyPlayer #${instanceIdRef.current}] ${msg}`, ...args)
  }, [])

  // 创建视频帧渲染器
  const createVideoFrameRenderer = useCallback(async () => {
    if (WebGLVideoFrameRenderer.isSupported) {
      const renderer = new WebGLVideoFrameRenderer()
      return {
        renderer,
        element: renderer.canvas as HTMLCanvasElement,
      }
    }

    const renderer = new BitmapVideoFrameRenderer()
    return {
      renderer,
      element: renderer.canvas as HTMLCanvasElement,
    }
  }, [])

  // 创建解码器
  const createDecoder = useCallback(
    async (codecId: ScrcpyVideoCodecId) => {
      if (!WebCodecsVideoDecoder.isSupported) {
        throw new Error('当前浏览器不支持 WebCodecs API，请使用最新版 Chrome 或 Edge')
      }

      const { renderer, element } = await createVideoFrameRenderer()
      canvasRef.current = element

      // 添加 canvas 到容器
      if (containerRef.current && !element.parentElement) {
        containerRef.current.appendChild(element)
      }

      const decoder = new WebCodecsVideoDecoder({
        codec: codecId,
        renderer,
      })

      // 监听尺寸变化
      decoder.sizeChanged(({ width, height }) => {
        setScreenInfo({ width, height })
        log(`视频尺寸: ${width}x${height}`)
      })

      log('解码器已创建')
      return decoder
    },
    [createVideoFrameRenderer, log]
  )

  // 更新 canvas 尺寸
  const updateCanvasSize = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container || !screenInfo) return

    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const { width: originalWidth, height: originalHeight } = screenInfo

    const aspectRatio = originalWidth / originalHeight
    let targetWidth = containerWidth
    let targetHeight = containerWidth / aspectRatio

    if (targetHeight > containerHeight) {
      targetHeight = containerHeight
      targetWidth = containerHeight * aspectRatio
    }

    canvas.width = originalWidth
    canvas.height = originalHeight
    canvas.style.width = `${targetWidth}px`
    canvas.style.height = `${targetHeight}px`
  }, [screenInfo])

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => updateCanvasSize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updateCanvasSize])

  // 当屏幕信息变化时更新 canvas 尺寸
  useEffect(() => {
    updateCanvasSize()
  }, [screenInfo, updateCanvasSize])

  // 连接设备
  useEffect(() => {
    if (!deviceId) return

    const instanceId = instanceIdRef.current
    let mounted = true
    let socket: Socket | null = null
    let decoder: WebCodecsVideoDecoder | null = null
    let canvas: HTMLCanvasElement | null = null

    log(`挂载，设备: ${deviceId}`)

    const connect = async () => {
      try {
        setStatus('connecting')
        setErrorMessage(null)

        log(`创建 Socket 连接...`)
        socket = io(API_BASE_URL, {
          path: '/socket.io',
          transports: ['websocket'],
          timeout: 10000,
          reconnection: false,
          forceNew: true,
        })
        socketRef.current = socket

        // 先设置所有事件监听器，再等待连接
        const handleVideoMetadata = async (metadata: VideoMetadata) => {
          if (!mounted) {
            log(`收到元数据但组件已卸载，忽略`)
            return
          }

          try {
            log(`收到视频元数据:`, metadata)
            
            // 清理旧的解码器
            if (decoder) {
              decoder.dispose()
              decoder = null
            }
            
            // 获取 codec ID
            const codecId = metadata?.codec
              ? (metadata.codec as ScrcpyVideoCodecId)
              : ScrcpyVideoCodecId.H264
            
            // 创建解码器
            decoder = await createDecoder(codecId)
            decoderRef.current = decoder
            canvas = canvasRef.current
            
            // 设置视频流
            const videoStream = new ReadableStream<VideoPacket>({
              start(controller) {
                let configurationPacketSent = false
                let pendingDataPackets: VideoPacket[] = []

                const videoDataHandler = (data: VideoPacket) => {
                  if (!mounted) return
                  try {
                    const payload = {
                      ...data,
                      data: data.data instanceof Uint8Array
                        ? data.data
                        : new Uint8Array(data.data),
                    }
                    
                    if (payload.type === 'configuration') {
                      controller.enqueue(payload)
                      configurationPacketSent = true
                      pendingDataPackets.forEach(p => controller.enqueue(p))
                      pendingDataPackets = []
                    } else if (!configurationPacketSent) {
                      pendingDataPackets.push(payload)
                    } else {
                      controller.enqueue(payload)
                    }
                  } catch (error) {
                    console.error('视频数据入队失败:', error)
                  }
                }

                socket!.on('video-data', videoDataHandler)
              },
            })

            videoStream
              .pipeTo(decoder.writable as WritableStream<VideoPacket>)
              .catch((error: Error) => {
                if (!mounted) return
                console.error('视频流错误:', error)
                setStatus('error')
                setErrorMessage(error.message)
                onError?.(error.message)
              })
            
            setStatus('connected')
            log(`视频流已连接`)
            onReadyRef.current?.()
          } catch (e: any) {
            console.error('初始化失败:', e)
            if (mounted) {
              setStatus('error')
              setErrorMessage(e.message)
              onErrorRef.current?.(e.message)
            }
          }
        }

        // 设置事件监听器
        socket.on('video-metadata', handleVideoMetadata)

        socket.on('error', (error: { message?: string }) => {
          if (!mounted) return
          const msg = error?.message || 'Socket 错误'
          console.error('Socket 错误:', msg)
          setStatus('error')
          setErrorMessage(msg)
          onErrorRef.current?.(msg)
        })

        socket.on('disconnect', (reason) => {
          if (!mounted) return
          log(`Socket 断开: ${reason}`)
          setStatus('error')
          setErrorMessage('连接已断开')
        })

        socket.on('connect_error', (error) => {
          if (!mounted) return
          log(`连接错误:`, error)
          setStatus('error')
          setErrorMessage('连接失败')
          onErrorRef.current?.('连接失败')
        })

        // 等待连接成功后发送 connect-device
        socket.on('connect', () => {
          if (!mounted) return
          log(`Socket 已连接，发送 connect-device`)
          socket!.emit('connect-device', {
            device_id: deviceId,
            maxSize,
            bitRate,
          })
        })

        // 如果 socket 已经连接（不太可能，但以防万一）
        if (socket.connected) {
          log(`Socket 已经连接，立即发送 connect-device`)
          socket.emit('connect-device', {
            device_id: deviceId,
            maxSize,
            bitRate,
          })
        }

      } catch (e: any) {
        if (!mounted) return
        console.error('连接失败:', e)
        setStatus('error')
        setErrorMessage(e.message)
        onErrorRef.current?.(e.message)
      }
    }

    connect()

    return () => {
      mounted = false
      log(`卸载，开始清理...`)
      
      // 1. 断开 Socket
      if (socket) {
        log(`断开 Socket`)
        socket.removeAllListeners()
        socket.disconnect()
        socket = null
        socketRef.current = null
      }
      
      // 2. 清理解码器
      if (decoder) {
        log(`释放解码器`)
        try {
          decoder.dispose()
        } catch (e) {
          console.error('关闭解码器失败:', e)
        }
        decoder = null
        decoderRef.current = null
      }
      
      // 3. 清理 canvas
      if (canvas && canvas.parentElement) {
        log(`移除 Canvas`)
        try {
          canvas.parentElement.removeChild(canvas)
        } catch (e) {
          console.error('移除 Canvas 失败:', e)
        }
      }
      canvasRef.current = null
      
      log(`清理完成`)
    }
  }, [deviceId, maxSize, bitRate])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000' }}
    >
      {status === 'connecting' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#fff',
            textAlign: 'center',
            zIndex: 10,
          }}
        >
          <div style={{ marginBottom: 8 }}>正在连接视频流...</div>
          <div style={{ fontSize: 12, color: '#999' }}>首次连接需要 3-5 秒</div>
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
            zIndex: 10,
          }}
        >
          <div>{errorMessage || '视频流错误'}</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>请检查设备连接</div>
        </div>
      )}
    </div>
  )
}
