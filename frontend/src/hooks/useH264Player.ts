import { useEffect, useRef, useState } from 'react'

interface UseH264PlayerOptions {
  deviceId: string | null
  enabled: boolean
  canvasRef: React.RefObject<HTMLCanvasElement>
}

interface UseH264PlayerResult {
  supported: boolean
  error: string | null
  stats: {
    frames: number
    width: number | null
    height: number | null
  }
}

// 简单检测浏览器是否支持 WebCodecs
const isWebCodecsSupported =
  typeof window !== 'undefined' &&
  typeof (window as any).VideoDecoder !== 'undefined' &&
  typeof (window as any).EncodedVideoChunk !== 'undefined'

// 判断NALU类型，检测是否包含关键帧
function hasKeyFrame(data: Uint8Array): boolean {
  // 搜索 start code (0x00000001 或 0x000001)
  for (let i = 0; i + 4 <= data.length; i++) {
    const sc4 = data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x00 && data[i + 3] === 0x01
    const sc3 = data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01
    if (sc4 || sc3) {
      const offset = sc4 ? i + 4 : i + 3
      if (offset < data.length) {
        const naluType = data[offset] & 0x1f
        // 5=IDR, 7=SPS, 8=PPS 都视为关键帧
        if (naluType === 5 || naluType === 7 || naluType === 8) {
          return true
        }
      }
    }
  }
  return false
}

export function useH264Player(options: UseH264PlayerOptions): UseH264PlayerResult {
  const { deviceId, enabled, canvasRef } = options
  const [error, setError] = useState<string | null>(null)
  const [frames, setFrames] = useState(0)
  const [size, setSize] = useState<{ width: number | null; height: number | null }>({ width: null, height: null })

  const wsRef = useRef<WebSocket | null>(null)
  const decoderRef = useRef<VideoDecoder | null>(null)
  const frameCounterRef = useRef(0)
  const timestampRef = useRef(0)

  useEffect(() => {
    if (!enabled || !deviceId || !isWebCodecsSupported) {
      return () => {}
    }

    const canvas = canvasRef.current
    if (!canvas) {
      setError('Canvas 未就绪')
      return () => {}
    }
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('无法获取 Canvas 上下文')
      return () => {}
    }

    setError(null)
    frameCounterRef.current = 0
    timestampRef.current = 0

    // 创建解码器
    const decoder = new VideoDecoder({
      output: (frame) => {
        try {
          const { codedWidth, codedHeight } = frame
          canvas.width = codedWidth
          canvas.height = codedHeight
          setSize({ width: codedWidth, height: codedHeight })
          ctx.drawImage(frame, 0, 0, codedWidth, codedHeight)
          frameCounterRef.current += 1
          setFrames(frameCounterRef.current)
        } catch (e) {
          console.error('渲染帧失败:', e)
        } finally {
          frame.close()
        }
      },
      error: (e) => {
        console.error('解码错误:', e)
        setError(String(e))
      },
    })

    decoderRef.current = decoder

    // 连接 WebSocket（H264二进制流）
    const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8001').replace('http', 'ws')
    const url = `${wsUrl}/api/v1/ws/h264/${deviceId}`
    const ws = new WebSocket(url)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      console.log('H264 WebSocket 已连接', url)
    }

    ws.onmessage = (evt) => {
      if (!(evt.data instanceof ArrayBuffer)) {
        return
      }
      const data = new Uint8Array(evt.data)
      const key = hasKeyFrame(data) ? 'key' : 'delta'
      try {
        // 递增时间戳（微秒）
        timestampRef.current += 33000
        const chunk = new EncodedVideoChunk({
          type: key as EncodedVideoChunkType,
          timestamp: timestampRef.current,
          data,
        })
        if (decoder.state !== 'closed') {
          decoder.decode(chunk)
        }
      } catch (e) {
        console.error('解码投喂失败:', e)
        setError(String(e))
      }
    }

    ws.onerror = (e) => {
      console.error('H264 WebSocket 错误:', e)
      setError('WebSocket 错误')
    }

    ws.onclose = () => {
      console.log('H264 WebSocket 关闭')
    }

    return () => {
      try {
        ws.close()
      } catch {}
      wsRef.current = null
      try {
        decoder.close()
      } catch {}
      decoderRef.current = null
    }
  }, [deviceId, enabled, canvasRef])

  return {
    supported: isWebCodecsSupported,
    error,
    stats: {
      frames,
      width: size.width,
      height: size.height,
    },
  }
}

