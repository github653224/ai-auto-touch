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
      
      // 检测是否是 JPEG 图片（JPEG 文件头：FF D8 FF）
      const isJPEG = data.length >= 3 && 
        data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF
      
      // 检测是否是 PNG 图片（PNG 文件头：89 50 4E 47 0D 0A 1A 0A）
      const isPNG = data.length >= 8 && 
        data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47 &&
        data[4] === 0x0D && data[5] === 0x0A && data[6] === 0x1A && data[7] === 0x0A
      
      if (isJPEG || isPNG) {
        // 如果是图片（JPEG 或 PNG），转换为 base64 并显示
        try {
          // 使用更高效的方式转换 base64
          const binary = Array.from(data, byte => String.fromCharCode(byte)).join('')
          const base64 = btoa(binary)
          const mimeType = isJPEG ? 'image/jpeg' : 'image/png'
          
          const img = new Image()
          img.onload = () => {
            if (canvas) {
              canvas.width = img.width
              canvas.height = img.height
              setSize({ width: img.width, height: img.height })
              const ctx = canvas.getContext('2d')
              if (ctx) {
                ctx.drawImage(img, 0, 0)
                frameCounterRef.current += 1
                setFrames(frameCounterRef.current)
              }
            }
          }
          img.onerror = (e) => {
            console.error('图片加载失败:', e)
          }
          img.src = `data:${mimeType};base64,${base64}`
        } catch (e) {
          console.error('图片显示失败:', e)
          setError(String(e))
        }
        return
      }
      
      // 否则尝试作为 H264 数据解码
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

