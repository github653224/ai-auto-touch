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
  const hasReceivedDataRef = useRef(false)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [screenInfo, setScreenInfo] = useState<{ width: number; height: number } | null>(null)

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
        console.log(`✅ 视频尺寸: ${width}x${height}`)
      })

      console.log('✅ 解码器已创建')
      return decoder
    },
    [createVideoFrameRenderer]
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

  // 标记已收到数据
  const markDataReceived = useCallback(() => {
    if (hasReceivedDataRef.current) return
    hasReceivedDataRef.current = true
  }, [])

  // 设置视频流
  const setupVideoStream = useCallback(
    (_metadata: VideoMetadata) => {
      let configurationPacketSent = false
      let pendingDataPackets: VideoPacket[] = []

      const transformStream = new TransformStream<VideoPacket, VideoPacket>({
        transform(packet, controller) {
          if (packet.type === 'configuration') {
            controller.enqueue(packet)
            configurationPacketSent = true

            if (pendingDataPackets.length > 0) {
              pendingDataPackets.forEach(p => controller.enqueue(p))
              pendingDataPackets = []
            }
            return
          }

          if (packet.type === 'data' && !configurationPacketSent) {
            pendingDataPackets.push(packet)
            return
          }

          controller.enqueue(packet)
        },
      })

      const videoStream = new ReadableStream<VideoPacket>({
        start(controller) {
          let streamClosed = false

          const videoDataHandler = (data: VideoPacket) => {
            if (streamClosed) return
            try {
              markDataReceived()
              const payload = {
                ...data,
                data:
                  data.data instanceof Uint8Array
                    ? data.data
                    : new Uint8Array(data.data),
              }
              controller.enqueue(payload)
            } catch (error) {
              console.error('❌ 视频数据入队失败:', error)
              streamClosed = true
              cleanup()
            }
          }

          const errorHandler = (error: { message?: string }) => {
            if (streamClosed) return
            controller.error(new Error(error?.message || 'Socket 错误'))
            streamClosed = true
            cleanup()
          }

          const disconnectHandler = () => {
            if (streamClosed) return
            controller.close()
            streamClosed = true
            cleanup()
          }

          const cleanup = () => {
            socketRef.current?.off('video-data', videoDataHandler)
            socketRef.current?.off('error', errorHandler)
            socketRef.current?.off('disconnect', disconnectHandler)
          }

          socketRef.current?.on('video-data', videoDataHandler)
          socketRef.current?.on('error', errorHandler)
          socketRef.current?.on('disconnect', disconnectHandler)

          return () => {
            streamClosed = true
            cleanup()
          }
        },
      })

      return videoStream.pipeThrough(transformStream)
    },
    [markDataReceived]
  )

  // 连接设备
  useEffect(() => {
    if (!deviceId) return

    let mounted = true
    hasReceivedDataRef.current = false

    const connect = async () => {
      try {
        setStatus('connecting')
        setErrorMessage(null)

        const socket = io(API_BASE_URL, {
          path: '/socket.io',
          transports: ['websocket'],
          timeout: 10000,
        })

        socketRef.current = socket

        socket.on('connect', () => {
          console.log('✅ Socket.IO 已连接到:', API_BASE_URL)
          socket.emit('connect-device', {
            device_id: deviceId,
            maxSize,
            bitRate,
          })
        })

        socket.on('video-metadata', async (metadata: VideoMetadata) => {
          if (!mounted) return

          try {
            console.log('✅ 收到视频元数据:', metadata)
            
            // 清理旧的解码器
            if (decoderRef.current) {
              decoderRef.current.dispose()
              decoderRef.current = null
            }
            
            // 获取 codec ID
            const codecId = metadata?.codec
              ? (metadata.codec as ScrcpyVideoCodecId)
              : ScrcpyVideoCodecId.H264
            
            // 创建解码器
            const decoder = await createDecoder(codecId)
            decoderRef.current = decoder
            
            // 设置视频流
            const videoStream = setupVideoStream(metadata)
            videoStream
              .pipeTo(decoder.writable as WritableStream<VideoPacket>)
              .catch((error: Error) => {
                console.error('❌ 视频流错误:', error)
                if (mounted) {
                  setStatus('error')
                  setErrorMessage(error.message)
                  onError?.(error.message)
                }
              })
            
            setStatus('connected')
            onReady?.()
          } catch (e: any) {
            console.error('❌ 初始化失败:', e)
            if (mounted) {
              setStatus('error')
              setErrorMessage(e.message)
              onError?.(e.message)
            }
            socket.close()
          }
        })

        socket.on('error', (error: { message?: string }) => {
          if (!mounted) return
          const msg = error?.message || 'Socket 错误'
          console.error('❌ Socket 错误:', msg)
          setStatus('error')
          setErrorMessage(msg)
          onError?.(msg)
        })

        socket.on('disconnect', () => {
          if (!mounted) return
          console.log('⚠️ Socket.IO 已断开')
          setStatus('error')
          setErrorMessage('连接已断开')
        })
      } catch (e: any) {
        if (!mounted) return
        console.error('❌ 连接失败:', e)
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
          decoderRef.current.dispose()
        } catch (e) {
          console.error('关闭解码器失败:', e)
        }
        decoderRef.current = null
      }
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
      }
      // 清理 canvas
      canvasRef.current = null
    }
  }, [deviceId, maxSize, bitRate, createDecoder, setupVideoStream, onReady, onError])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', backgroundColor: '#000' }}
    >
      {/* Canvas 会由解码器动态添加 */}
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
