import { useEffect, useRef, useState } from 'react'

interface UseH264PlayerOptions {
  deviceId: string | null
  enabled: boolean
  canvasRef: React.RefObject<HTMLCanvasElement>
  maxSize?: number  // 最大分辨率（像素）
  bitRate?: number  // 比特率（Mbps）
}

interface UseH264PlayerResult {
  supported: boolean
  error: string | null
  stats: {
    frames: number
    width: number | null
    height: number | null
  }
  updateConfig?: (config: { maxSize?: number; bitRate?: number }) => void
}

// 简单检测浏览器是否支持 WebCodecs
const isWebCodecsSupported =
  typeof window !== 'undefined' &&
  typeof (window as any).VideoDecoder !== 'undefined' &&
  typeof (window as any).EncodedVideoChunk !== 'undefined'

// 提取 SPS 和 PPS NAL 单元
function extractSPSPPS(data: Uint8Array): { sps: Uint8Array | null; pps: Uint8Array | null } {
  let sps: Uint8Array | null = null
  let pps: Uint8Array | null = null
  
  if (!data || data.length === 0) {
    return { sps, pps }
  }
  
  let i = 0
  // 修复循环条件：应该检查到数据末尾，而不仅仅是 i+4 <= data.length
  while (i < data.length) {
    // 检查4字节start code: 0x00000001
    const sc4 = i + 4 <= data.length && 
                data[i] === 0x00 && data[i + 1] === 0x00 && 
                data[i + 2] === 0x00 && data[i + 3] === 0x01
    // 检查3字节start code: 0x000001
    const sc3 = i + 3 <= data.length && 
                data[i] === 0x00 && data[i + 1] === 0x00 && data[i + 2] === 0x01
    
    if (sc4 || sc3) {
      const offset = sc4 ? i + 4 : i + 3
      if (offset < data.length) {
        const naluType = data[offset] & 0x1f
        
        // 查找下一个 start code
        let nextStart = -1
        for (let j = offset + 1; j < data.length; j++) {
          const nextSc4 = j + 4 <= data.length && 
                         data[j] === 0x00 && data[j + 1] === 0x00 && 
                         data[j + 2] === 0x00 && data[j + 3] === 0x01
          const nextSc3 = j + 3 <= data.length && 
                         data[j] === 0x00 && data[j + 1] === 0x00 && data[j + 2] === 0x01
          if (nextSc4 || nextSc3) {
            nextStart = j
            break
          }
        }
        
        const naluEnd = nextStart > 0 ? nextStart : data.length
        const naluData = data.slice(offset, naluEnd)
        
        if (naluType === 7) { // SPS
          sps = naluData
        } else if (naluType === 8) { // PPS
          pps = naluData
        }
        
        i = nextStart > 0 ? nextStart : data.length
      } else {
        i++
      }
    } else {
      i++
    }
  }
  
  return { sps, pps }
}

export function useH264Player(options: UseH264PlayerOptions): UseH264PlayerResult {
  const { deviceId, enabled, canvasRef, maxSize = 1080, bitRate = 4 } = options
  const [error, setError] = useState<string | null>(null)
  const [frames, setFrames] = useState(0)
  const [size, setSize] = useState<{ width: number | null; height: number | null }>({ width: null, height: null })

  const wsRef = useRef<WebSocket | null>(null)
  const decoderRef = useRef<VideoDecoder | null>(null)
  const frameCounterRef = useRef(0)
  const timestampRef = useRef(0)
  const spsPpsBufferRef = useRef<Uint8Array>(new Uint8Array(0)) // 用于累积查找 SPS/PPS 的缓冲区
  const naluBufferRef = useRef<Uint8Array>(new Uint8Array(0)) // 用于累积不完整的 NALU 数据
  const waitForIDRRef = useRef(false) // 配置后等待 IDR 帧
  const decoderConfiguredRef = useRef(false) // 解码器配置状态（使用ref避免作用域问题）
  const [connected, setConnected] = useState(false)
  
  // 添加 updateConfig 函数，用于实时更新配置
  // 注意：这个函数需要在 useEffect 外部定义，这样即使 enabled 为 false 也能返回
  const updateConfig = (config: { maxSize?: number; bitRate?: number }) => {
    const ws = wsRef.current
    console.log('🔧 updateConfig 被调用:', { 
      config, 
      wsExists: !!ws, 
      wsReadyState: ws?.readyState,
      enabled,
      deviceId 
    })
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: 'config',
          max_size: config.maxSize ?? maxSize,
          bit_rate: config.bitRate ?? bitRate
        }))
        console.log(`📤 已发送实时配置更新: 分辨率=${config.maxSize ?? maxSize}p, 比特率=${config.bitRate ?? bitRate}Mbps`)
      } catch (e) {
        console.warn('发送实时配置更新失败:', e)
      }
    } else {
      console.warn('WebSocket 未连接，无法发送实时配置更新', {
        wsExists: !!ws,
        wsReadyState: ws?.readyState,
        WebSocket_OPEN: WebSocket.OPEN
      })
    }
  }

  useEffect(() => {
    if (!enabled || !deviceId) {
      console.log('H264 Player: 未启用或设备ID为空', { enabled, deviceId, isWebCodecsSupported })
      return () => {}
    }
    
    if (!isWebCodecsSupported) {
      console.warn('H264 Player: 浏览器不支持 WebCodecs API')
      setError('浏览器不支持 WebCodecs API，请使用 Chrome/Edge 浏览器')
      return () => {}
    }

    // 等待 canvas 准备好（使用 setTimeout 确保 DOM 已渲染）
    let retryCount = 0
    const maxRetries = 50 // 最多重试50次（5秒）
    
    const checkCanvas = () => {
      const canvas = canvasRef.current
      if (!canvas) {
        retryCount++
        if (retryCount >= maxRetries) {
          console.error('H264 Player: Canvas 未就绪，已达到最大重试次数')
          setError('Canvas 元素未找到，请刷新页面重试')
          return
        }
        // 延迟重试
        const delay = retryCount < 5 ? 50 : 100
        setTimeout(checkCanvas, delay)
        return
      }
      
      // 重置重试计数
      retryCount = 0
      
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setError('无法获取 Canvas 上下文')
        return
      }
      
      console.log('✅ H264 Player: Canvas 已就绪，开始初始化播放器')
      
      // Canvas 已准备好，继续初始化
      initPlayer(canvas, ctx)
    }
    
    let cleanup: (() => void) | null = null
    let isCleaningUp = false // 标记是否正在清理，防止重复清理
    
    const initPlayer = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      setError(null)
      frameCounterRef.current = 0
      timestampRef.current = 0
      // 重置数据块计数器
      ;(window as any).__h264DataBlockCount = 0

      // 创建解码器
      const decoder = new VideoDecoder({
        output: (frame) => {
          try {
            const { codedWidth, codedHeight } = frame
            if (frameCounterRef.current === 0) {
              console.log(`✅ H264 解码器输出第一帧: ${codedWidth}x${codedHeight}`)
              console.log(`   Canvas 尺寸: ${canvas.width}x${canvas.height}`)
              const computedStyle = window.getComputedStyle(canvas)
              console.log(`   Canvas 显示状态: display=${computedStyle.display}, opacity=${computedStyle.opacity}, visibility=${computedStyle.visibility}`)
              console.log(`   Canvas 位置: ${canvas.offsetWidth}x${canvas.offsetHeight}, 父容器: ${canvas.parentElement?.offsetWidth}x${canvas.parentElement?.offsetHeight}`)
            }
            
            // 确保 Canvas 尺寸正确
            if (canvas.width !== codedWidth || canvas.height !== codedHeight) {
              console.log(`📐 更新 Canvas 尺寸: ${canvas.width}x${canvas.height} -> ${codedWidth}x${codedHeight}`)
            canvas.width = codedWidth
            canvas.height = codedHeight
            }
            
            setSize({ width: codedWidth, height: codedHeight })
            
            // 绘制帧到 Canvas
            ctx.drawImage(frame, 0, 0, codedWidth, codedHeight)
            
            frameCounterRef.current += 1
            setFrames(frameCounterRef.current)
            
            if (frameCounterRef.current <= 3 || frameCounterRef.current % 30 === 0) {
              console.log(`✅ H264 已渲染第 ${frameCounterRef.current} 帧: ${codedWidth}x${codedHeight}`)
              // 检查 Canvas 是否真的可见
              const rect = canvas.getBoundingClientRect()
              console.log(`   Canvas 实际显示区域: ${rect.width}x${rect.height}, 位置: (${rect.left}, ${rect.top})`)
            }
          } catch (e) {
            console.error('渲染帧失败:', e)
            console.error('   Canvas 状态:', {
              width: canvas.width,
              height: canvas.height,
              display: window.getComputedStyle(canvas).display,
              visibility: window.getComputedStyle(canvas).visibility,
            })
            setError('渲染帧失败: ' + String(e))
          } finally {
            frame.close()
          }
        },
        error: (e) => {
          console.error('解码错误:', e)
          console.error('   解码器状态:', decoderRef.current?.state)
          console.error('   错误详情:', e.message || e)
          setError('解码错误: ' + String(e))
          // 解码器遇到错误后状态会变成 closed，需要重新创建
          const currentDecoder = decoderRef.current;
          if (currentDecoder && currentDecoder.state === 'closed') {
            console.warn('解码器已关闭，将在下次收到数据时重新创建')
            // 重置等待 IDR 帧的状态，这样重新配置后可以立即处理后续的 IDR 帧
            waitForIDRRef.current = false
            decoderConfiguredRef.current = false
            decoderRef.current = null
          }
        },
      })

      decoderRef.current = decoder
      
      // 重置解码器配置状态（使用外部的 decoderConfiguredRef）
      decoderConfiguredRef.current = false
      
      // 重置 SPS/PPS 缓冲区和 NALU 缓冲区
      spsPpsBufferRef.current = new Uint8Array(0)
      naluBufferRef.current = new Uint8Array(0)

      // 连接 WebSocket（H264二进制流）
      const wsUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8001').replace('http', 'ws')
      const url = `${wsUrl}/api/v1/ws/h264/${deviceId}`
      console.log('H264 Player: 正在连接 WebSocket', url)
      const ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
      wsRef.current = ws

      // 添加连接超时检测（WebSocket 连接建立超时）
      let connectionTimeout: ReturnType<typeof setTimeout> | null = null
      connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          console.warn('H264 WebSocket 连接超时')
          setError('连接超时，请检查后端服务是否运行或切换到截图模式')
          ws.close()
        }
      }, 15000) // 增加到15秒超时
      
      // 添加数据接收超时检测（连接建立后，等待数据）
      let dataTimeout: ReturnType<typeof setTimeout> | null = null

      ws.onopen = () => {
        console.log('✅ H264 WebSocket 已连接', url)
        
        // 发送配置参数
        try {
          ws.send(JSON.stringify({
            type: 'config',
            max_size: maxSize,
            bit_rate: bitRate  // 发送Mbps值，后端会转换为bps
          }))
          console.log(`📤 已发送H264配置: 分辨率=${maxSize}p, 比特率=${bitRate}Mbps`)
        } catch (e) {
          console.warn('发送配置失败:', e)
        }
        
        // 清除连接超时
        if (connectionTimeout) {
          clearTimeout(connectionTimeout)
          connectionTimeout = null
        }
        // 设置数据接收超时：如果连接建立后10秒内没有收到任何数据，显示超时
        dataTimeout = setTimeout(() => {
          if (!connected) {
            console.warn('H264 数据接收超时')
            setError('数据接收超时，后端可能正在初始化，请稍候或切换到截图模式')
          }
        }, 10000) // 10秒超时
      }

      ws.onmessage = (evt) => {
        // 处理文本消息（JSON格式，用于连接确认、回退通知和错误消息）
        if (typeof evt.data === 'string') {
          try {
            const jsonData = JSON.parse(evt.data)
            if (jsonData.type === 'connected') {
              console.log('✅', jsonData.message || '连接已建立')
              // 连接确认消息，清除错误，标记为已连接
              setError(null)
              setConnected(true)
              // 清除数据接收超时
              if (dataTimeout) {
                clearTimeout(dataTimeout)
                dataTimeout = null
              }
            } else if (jsonData.type === 'fallback') {
              console.log('📸 后端已切换到截图模式:', jsonData.message)
              // 回退到截图模式是正常的，清除错误，标记为已连接
              // 这样前端就知道连接已建立，只是使用的是截图模式而不是真正的 H264
              setError(null)
              setConnected(true)
              // 清除数据接收超时
              if (dataTimeout) {
                clearTimeout(dataTimeout)
                dataTimeout = null
              }
              // 注意：虽然 connected 为 true，但前端应该知道这是截图模式
              // 实际的视频数据会以 PNG 格式通过二进制消息发送
            } else if (jsonData.type === 'error') {
              console.error('❌ 后端错误:', jsonData.message)
              setError(jsonData.message || '后端错误')
              // 清除数据接收超时
              if (dataTimeout) {
                clearTimeout(dataTimeout)
                dataTimeout = null
              }
              // 错误时不一定断开连接，取决于错误类型
              // 如果是致命错误，后端会关闭连接
            }
          } catch (e) {
            console.warn('收到非JSON文本消息:', evt.data.substring(0, 100))
          }
          return
        }
        
        // 处理二进制数据
        if (!(evt.data instanceof ArrayBuffer)) {
          console.warn('收到非二进制数据:', typeof evt.data, evt.data)
          return
        }
        
        // 收到任何数据，清除数据接收超时
        if (dataTimeout) {
          clearTimeout(dataTimeout)
          dataTimeout = null
        }
        
        // 收到数据意味着连接已建立，标记为已连接
        setConnected(true)
        setError(null)
        
        const data = new Uint8Array(evt.data)
        
        // 记录数据块信息（使用一个独立的计数器，因为 frameCounterRef 只在解码器输出帧时才更新）
        const dataBlockCount = (window as any).__h264DataBlockCount = ((window as any).__h264DataBlockCount || 0) + 1
        
        if (dataBlockCount === 1) {
          console.log(`📦 收到第一个二进制数据块，大小: ${data.length} 字节`)
          // 打印前32字节的十六进制，用于调试
          const hexPreview = Array.from(data.slice(0, Math.min(32, data.length)))
            .map(b => b.toString(16).padStart(2, '0'))
            .join(' ')
          console.log(`   前32字节: ${hexPreview}`)
          // 检查 Canvas 状态
          if (canvasRef.current) {
            const canvas = canvasRef.current
            const computedStyle = window.getComputedStyle(canvas)
            const rect = canvas.getBoundingClientRect()
            console.log(`   Canvas 状态: ${canvas.width}x${canvas.height}, display=${computedStyle.display}, opacity=${computedStyle.opacity}, visibility=${computedStyle.visibility}`)
            console.log(`   Canvas 实际显示区域: ${rect.width}x${rect.height}, 位置: (${rect.left}, ${rect.top})`)
          } else {
            console.warn('   ⚠️ Canvas ref 为空！')
          }
        }
        
        // 如果收到多个数据块但解码器仍未配置，使用数据块计数来触发默认配置
        if (!decoderConfiguredRef.current && dataBlockCount > 5) {
          console.warn(`⚠️ 解码器未配置，已收到 ${dataBlockCount} 个数据块，仍未找到 SPS/PPS，尝试使用默认配置`)
          // 触发默认配置逻辑（在下面的代码中处理）
        }
        
        // 检测是否是 JPEG 图片（JPEG 文件头：FF D8 FF）
        const isJPEG = data.length >= 3 && 
          data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF
        
        // 检测是否是 PNG 图片（PNG 文件头：89 50 4E 47 0D 0A 1A 0A）
        const isPNG = data.length >= 8 && 
          data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47 &&
          data[4] === 0x0D && data[5] === 0x0A && data[6] === 0x1A && data[7] === 0x0A
        
        if (isJPEG || isPNG) {
          // 如果是图片（JPEG 或 PNG），说明后端回退到了截图模式
          // 转换为 base64 并显示在 Canvas 上
          try {
            console.log(`📸 收到 ${isJPEG ? 'JPEG' : 'PNG'} 图片（回退模式），大小: ${data.length} 字节`)
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
                  if (frameCounterRef.current <= 3 || frameCounterRef.current % 30 === 0) {
                    console.log(`✅ 已显示第 ${frameCounterRef.current} 帧图片（${img.width}x${img.height}）`)
                }
                } else {
                  console.error('无法获取 Canvas 上下文')
                }
              } else {
                console.error('Canvas 元素不存在')
              }
            }
            img.onerror = (e) => {
              console.error('图片加载失败:', e)
              setError('图片加载失败: ' + String(e))
            }
            img.src = `data:${mimeType};base64,${base64}`
          } catch (e) {
            console.error('图片显示失败:', e)
            setError('图片显示失败: ' + String(e))
          }
          return
        }
        
        // 如果解码器未配置，需要先提取完整的NALU，然后累积到缓冲区查找SPS/PPS
        // 注意：后端发送的每个NALU都是完整的（包含start code），但可能被WebSocket/TCP分割
        if (!decoderConfiguredRef.current) {
          // 先处理NALU缓冲区，提取完整的NALU
          // 累积数据到 NALU 缓冲区（处理可能被分割的 NALU）
          const combinedData = naluBufferRef.current.length > 0 
            ? new Uint8Array(naluBufferRef.current.length + data.length)
            : data
          
          if (naluBufferRef.current.length > 0) {
            combinedData.set(naluBufferRef.current, 0)
            combinedData.set(data, naluBufferRef.current.length)
          }
          
          // 查找第一个 start code
          let startCodePos = -1
          let startCodeLen = 0
          for (let i = 0; i < combinedData.length; i++) {
            if (i + 4 <= combinedData.length && 
                combinedData[i] === 0x00 && combinedData[i + 1] === 0x00 && 
                combinedData[i + 2] === 0x00 && combinedData[i + 3] === 0x01) {
              startCodePos = i
              startCodeLen = 4
              break
            }
            if (i + 3 <= combinedData.length && 
                combinedData[i] === 0x00 && combinedData[i + 1] === 0x00 && 
                combinedData[i + 2] === 0x01) {
              startCodePos = i
              startCodeLen = 3
              break
            }
          }
          
          if (startCodePos === -1) {
            // 如果累积的数据还没有 start code，继续累积
            if (combinedData.length < 50000) {
              naluBufferRef.current = combinedData
              const dataBlockCount = (window as any).__h264DataBlockCount || 0
              if (dataBlockCount <= 5) {
                console.log(`📦 数据块不包含 start code，累积到缓冲区（大小: ${combinedData.length} 字节）`)
              }
              return
            } else {
              console.warn(`⚠️ 数据块不包含 start code 且数据较大（${combinedData.length} 字节），清空缓冲区`)
              naluBufferRef.current = new Uint8Array(0)
              return
            }
          }
          
          // 查找下一个 start code，确定 NALU 的结束位置
          let naluEnd = combinedData.length
          for (let i = startCodePos + startCodeLen + 1; i < combinedData.length; i++) {
            const nextSc4 = i + 4 <= combinedData.length && 
                           combinedData[i] === 0x00 && combinedData[i + 1] === 0x00 && 
                           combinedData[i + 2] === 0x00 && combinedData[i + 3] === 0x01
            const nextSc3 = i + 3 <= combinedData.length && 
                           combinedData[i] === 0x00 && combinedData[i + 1] === 0x00 && 
                           combinedData[i + 2] === 0x01
            if (nextSc4 || nextSc3) {
              naluEnd = i
              break
            }
          }
          
          // 提取完整的 NALU（包含start code）
          const completeNalu = combinedData.slice(startCodePos, naluEnd)
          // 保留剩余数据到缓冲区
          naluBufferRef.current = combinedData.slice(naluEnd)
          
          // 将完整的NALU累积到SPS/PPS缓冲区
          if (spsPpsBufferRef.current.length < 51200) {
            const combined = new Uint8Array(spsPpsBufferRef.current.length + completeNalu.length)
            combined.set(spsPpsBufferRef.current, 0)
            combined.set(completeNalu, spsPpsBufferRef.current.length)
            spsPpsBufferRef.current = combined
            
            // 检查NALU类型
            const naluType = completeNalu.length > startCodeLen ? (completeNalu[startCodeLen] & 0x1f) : 0
            const naluTypeName = {7: 'SPS', 8: 'PPS', 5: 'IDR', 1: 'P帧'}[naluType] || `类型${naluType}`
            if (frameCounterRef.current <= 10 || naluType === 7 || naluType === 8) {
              console.log(`📦 累积完整NALU到SPS/PPS缓冲区，NALU大小: ${completeNalu.length} 字节，类型: ${naluTypeName}，缓冲区总大小: ${spsPpsBufferRef.current.length} 字节`)
            }
          } else {
            console.warn('⚠️ SPS/PPS缓冲区已满（50KB），停止累积，可能丢失数据')
          }
          
          // 从累积缓冲区中查找 SPS/PPS
          const searchData = spsPpsBufferRef.current
          
          // 添加调试日志：检查累积的数据中是否包含start code和SPS/PPS
          if (searchData.length > 0) {
            const hasStartCode = searchData.length >= 4 && 
                               searchData[0] === 0x00 && searchData[1] === 0x00 && 
                               (searchData[2] === 0x00 && searchData[3] === 0x01 || searchData[2] === 0x01)
            const dataBlockCount = (window as any).__h264DataBlockCount || 0
            if (dataBlockCount <= 10) {
              console.log(`🔍 检查SPS/PPS缓冲区，大小: ${searchData.length} 字节，包含start code: ${hasStartCode}`)
              if (searchData.length >= 50) {
                const hexPreview = Array.from(searchData.slice(0, Math.min(50, searchData.length)))
                  .map(b => b.toString(16).padStart(2, '0'))
                  .join(' ')
                console.log(`   前50字节（hex）: ${hexPreview}`)
              }
            }
          }
          
          const { sps, pps } = extractSPSPPS(searchData)
          
          // 添加调试日志：显示提取结果
          console.log(`🔍 SPS/PPS提取结果: SPS=${sps ? sps.length + '字节' : 'null'}, PPS=${pps ? pps.length + '字节' : 'null'}, 缓冲区大小: ${searchData.length} 字节`)
          if (sps && pps) {
            console.log(`✅ 找到SPS/PPS！SPS大小: ${sps.length}字节, PPS大小: ${pps.length}字节`)
          } else {
            const dataBlockCount = (window as any).__h264DataBlockCount || 0
            if (searchData.length > 1000 && dataBlockCount <= 20) {
              // 如果缓冲区很大但还没找到SPS/PPS，打印前100字节用于调试
              const hexPreview = Array.from(searchData.slice(0, Math.min(100, searchData.length)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join(' ')
              console.log(`⚠️ 缓冲区大小 ${searchData.length} 字节但未找到SPS/PPS，前100字节: ${hexPreview}`)
            }
          }
          
          // 定义配置函数（在作用域内可用）
          const tryConfigure = (desc?: ArrayBuffer) => {
            // 检查解码器状态，如果已关闭则重新创建
            let currentDecoder = decoderRef.current
            if (!currentDecoder || currentDecoder.state === 'closed') {
              console.warn('解码器已关闭，重新创建解码器')
              if (currentDecoder) {
                try {
                  currentDecoder.close()
                } catch (e) {
                  // 忽略关闭错误
                }
              }
              
              // 重新创建解码器
              currentDecoder = new VideoDecoder({
                output: (frame) => {
                  console.log(`✅ H264 解码器输出帧 (重建后): ${frame.codedWidth}x${frame.codedHeight}`)
                  try {
                    const { codedWidth, codedHeight } = frame
                    if (canvasRef.current) {
                      canvasRef.current.width = codedWidth
                      canvasRef.current.height = codedHeight
                    }
                    setSize({ width: codedWidth, height: codedHeight })
                    if (ctx) {
                      ctx.drawImage(frame, 0, 0, codedWidth, codedHeight)
                    }
                    frameCounterRef.current += 1
                    setFrames(frameCounterRef.current)
                  } catch (e) {
                    console.error('渲染帧失败 (重建后):', e)
                  } finally {
                    frame.close()
                  }
                },
                error: (e) => {
                  console.error('解码错误 (重建后):', e)
                  if (currentDecoder && currentDecoder.state === 'closed') {
                    console.warn('解码器已关闭 (重建后)，将在下次收到数据时重新创建')
                    decoderConfiguredRef.current = false
                    decoderRef.current = null
                  }
                },
              })
              decoderRef.current = currentDecoder
            }
            
            const fallbackCodec = 'avc1.42E01E' // baseline 3.0
            let codecString = fallbackCodec
            if (sps && sps.length >= 4) {
              const profileIdc = sps[1]
              const levelIdc = sps[3]
              const profileHex = profileIdc.toString(16).padStart(2, '0').toUpperCase()
              const levelHex = levelIdc.toString(16).padStart(2, '0').toUpperCase()
              codecString = `avc1.${profileHex}00${levelHex}`
            }
            
            // 在配置解码器前检查其状态
            if (currentDecoder.state !== 'unconfigured') {
              console.log(`解码器状态不是 unconfigured，当前状态: ${currentDecoder.state}`);
              try {
                currentDecoder.close();
              } catch (e) {
                console.log('关闭解码器时出错:', e);
              }
              // 重新创建解码器以确保处于正确的状态
              currentDecoder = new VideoDecoder({
                output: (frame) => {
                  console.log(`✅ H264 解码器输出帧 (重建后): ${frame.codedWidth}x${frame.codedHeight}`)
                  try {
                    const { codedWidth, codedHeight } = frame
                    if (canvasRef.current) {
                      canvasRef.current.width = codedWidth
                      canvasRef.current.height = codedHeight
                    }
                    setSize({ width: codedWidth, height: codedHeight })
                    if (ctx) {
                      ctx.drawImage(frame, 0, 0, codedWidth, codedHeight)
                    }
                    frameCounterRef.current += 1
                    setFrames(frameCounterRef.current)
                  } catch (e) {
                    console.error('渲染帧失败 (重建后):', e)
                  } finally {
                    frame.close()
                  }
                },
                error: (e) => {
                  console.error('解码错误 (重建后):', e)
                  if (currentDecoder && currentDecoder.state === 'closed') {
                    console.warn('解码器已关闭 (重建后)，将在下次收到数据时重新创建')
                    decoderConfiguredRef.current = false
                    decoderRef.current = null
                  }
                },
              });
              decoderRef.current = currentDecoder;
            }
            
            currentDecoder.configure({
              codec: codecString,
              codedWidth: 1920,
              codedHeight: 1080,
              hardwareAcceleration: 'prefer-hardware',
              description: desc,
            })
            decoderConfiguredRef.current = true
            // 记录等待开始时间（使用对象存储）
            waitForIDRRef.current = { value: true, startTime: Date.now() } as any
            console.log(`✅ H264 解码器已配置 codec=${codecString} desc=${!!desc}，等待 IDR 帧（如果5秒内未收到将尝试解码 P 帧）...`)
            console.log(`   解码器状态: ${currentDecoder.state}, 配置状态: ${decoderConfiguredRef.current}`)
            
            // 注意：configure() 是异步的，需要等待解码器状态变为 'configured' 才能使用
            // 这里不立即处理数据，而是等待下一个消息循环，确保配置完成
          }
          
          // 辅助函数：从缓冲区中提取并处理 IDR 帧
          const processIDRFromBuffer = (buffer: Uint8Array): boolean => {
            console.log('🔍 开始搜索缓冲区中的 IDR 帧，缓冲区大小:', buffer.length, '字节')
            let i = 0
            while (i + 3 <= buffer.length) {
              const sc4 = i + 4 <= buffer.length && buffer[i] === 0x00 && buffer[i + 1] === 0x00 && buffer[i + 2] === 0x00 && buffer[i + 3] === 0x01
              const sc3 = i + 3 <= buffer.length && buffer[i] === 0x00 && buffer[i + 1] === 0x00 && buffer[i + 2] === 0x01
              
              if (sc4 || sc3) {
                const offset = sc4 ? i + 4 : i + 3
                if (offset < buffer.length) {
                  const naluType = buffer[offset] & 0x1f
                  console.log(`   找到 NALU，类型: ${naluType}，位置: ${i}`)
                  if (naluType === 5) {
                    // 找到 IDR 帧，提取完整的 NALU
                    let nextStart = -1
                    for (let j = offset + 1; j + 3 <= buffer.length; j++) {
                      const nextSc4 = j + 4 <= buffer.length && buffer[j] === 0x00 && buffer[j + 1] === 0x00 && buffer[j + 2] === 0x00 && buffer[j + 3] === 0x01
                      const nextSc3 = j + 3 <= buffer.length && buffer[j] === 0x00 && buffer[j + 1] === 0x00 && buffer[j + 2] === 0x01
                      if (nextSc4 || nextSc3) {
                        nextStart = j
                        break
                      }
                    }
                    const naluEnd = nextStart > 0 ? nextStart : buffer.length
                    const idrNalu = buffer.slice(i, naluEnd)
                    console.log('✅ 在缓冲区中找到 IDR 帧，大小:', idrNalu.length, '字节，位置:', i, '-', naluEnd)
                    // 直接处理 IDR 帧（跳过等待逻辑）
                    waitForIDRRef.current = false
                    // 将 IDR 帧发送给解码器
                    try {
                      const finalDecoder = decoderRef.current
                      if (!finalDecoder) {
                        console.error('❌ 解码器不存在，无法处理 IDR 帧')
                        return false
                      }
                      if (finalDecoder.state !== 'configured') {
                        console.warn('⚠️ 解码器状态不是 configured:', finalDecoder.state, '，等待配置完成')
                        return false
                      }
                      
                      // 使用递增时间戳
          timestampRef.current += 33000
          const chunk = new EncodedVideoChunk({
                        type: 'key',
            timestamp: timestampRef.current,
                        data: idrNalu,
                      })
                      finalDecoder.decode(chunk)
                      frameCounterRef.current += 1
                      console.log('✅ 已投递 IDR 帧到解码器（从缓冲区），帧计数:', frameCounterRef.current)
                      return true
                    } catch (e) {
                      console.error('❌ 处理 IDR 帧失败:', e)
                      return false
                    }
                  }
                }
              }
              i++
            }
            console.log('❌ 缓冲区中未找到 IDR 帧')
            return false
          }

          if (sps && pps) {
            console.log('🔧 找到 SPS/PPS，开始配置解码器，数据大小:', searchData.length, '字节')
            console.log(`   SPS 大小: ${sps.length} 字节, PPS 大小: ${pps.length} 字节`)
            try {
              const spsLen = sps.length
              const ppsLen = pps.length
              const configSize = 8 + spsLen + 3 + ppsLen
              const description = new Uint8Array(configSize)
              let offset = 0
              description[offset++] = 0x01
              description[offset++] = sps[1]
              description[offset++] = sps[2]
              description[offset++] = sps[3]
              description[offset++] = 0xff
              description[offset++] = 0xe1
              description[offset++] = (spsLen >> 8) & 0xff
              description[offset++] = spsLen & 0xff
              description.set(sps, offset)
              offset += spsLen
              description[offset++] = 0x01
              description[offset++] = (ppsLen >> 8) & 0xff
              description[offset++] = ppsLen & 0xff
              description.set(pps, offset)

              tryConfigure(description.buffer)
              
              // 配置后，立即检查累积缓冲区中是否有 IDR 帧
              // 注意：IDR 帧可能在配置时已经到达并被累积到缓冲区中
              const bufferToCheck = spsPpsBufferRef.current
              if (bufferToCheck.length > 0) {
                console.log('🔍 配置完成后立即检查累积缓冲区中是否有 IDR 帧，缓冲区大小:', bufferToCheck.length, '字节')
                // 使用多次检查确保解码器配置完成
                let checkCount = 0
                const maxChecks = 20 // 最多检查20次（约1秒）
                
                const checkDecoder = () => {
                  checkCount++
                  const currentDecoder = decoderRef.current
                  
                  if (currentDecoder && currentDecoder.state === 'configured') {
                    console.log(`✅ 解码器已配置完成（检查 ${checkCount} 次），开始处理缓冲区中的 IDR 帧`)
                    if (processIDRFromBuffer(bufferToCheck)) {
                      // 找到并处理了 IDR 帧，清空缓冲区
                      spsPpsBufferRef.current = new Uint8Array(0)
                      console.log('✅ 已处理缓冲区中的 IDR 帧，缓冲区已清空')
                    } else {
                      console.warn('⚠️ 缓冲区中未找到 IDR 帧，将等待IDR帧自然到达')
                      waitForIDRRef.current = true // 恢复等待IDR帧的状态
                    }
                  } else if (checkCount < maxChecks) {
                    // 继续等待
                    if (checkCount <= 5 || checkCount % 5 === 0) {
                      console.log(`⏳ 等待解码器配置完成（检查 ${checkCount}/${maxChecks}），当前状态: ${currentDecoder?.state || 'null'}`)
                    }
                    setTimeout(checkDecoder, 50) // 每50ms检查一次
                  } else {
                    // 超时，等待IDR帧自然到达
                    console.warn('⚠️ 解码器配置超时，将等待IDR帧自然到达')
                    waitForIDRRef.current = true // 恢复等待IDR帧的状态
                  }
                }
                
                // 立即开始检查
                setTimeout(checkDecoder, 50) // 延迟50ms开始第一次检查
              } else {
                console.log('📦 配置时缓冲区为空，将等待IDR帧自然到达')
              }
            } catch (configErr) {
              console.error('配置解码器失败（携带描述）:', configErr)
              try {
                tryConfigure()
              } catch (fallbackErr) {
                console.error('配置解码器失败（无描述）:', fallbackErr)
                setError('解码器配置失败: ' + String(fallbackErr))
                return
              }
            }
          } else {
            // 如果没有 SPS/PPS，检查是否应该使用默认配置
            if (frameCounterRef.current > 5) {  // 只等待5个数据块就使用默认配置
              console.warn(`⚠️ 解码器未配置，已收到 ${frameCounterRef.current} 个数据块，仍未找到 SPS/PPS，尝试使用默认配置`)
              try {
                // 检查解码器状态
                let currentDecoder = decoderRef.current
                if (!currentDecoder || currentDecoder.state === 'closed') {
                  console.warn('解码器已关闭，重新创建解码器（默认配置）')
                  if (currentDecoder) {
                    try {
                      currentDecoder.close()
                    } catch (e) {
                      // 忽略关闭错误
                    }
                  }
                  currentDecoder = new VideoDecoder({
                    output: (frame) => {
                      try {
                        const { codedWidth, codedHeight } = frame
                        if (canvasRef.current) {
                          canvasRef.current.width = codedWidth
                          canvasRef.current.height = codedHeight
                        }
                        setSize({ width: codedWidth, height: codedHeight })
                        const canvasCtx = canvasRef.current?.getContext('2d');
                        if (canvasCtx && canvasRef.current) {
                          canvasCtx.drawImage(frame, 0, 0, codedWidth, codedHeight)
                        }
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
                      // 解码器遇到错误后状态会变成 closed，需要重新创建
                      if (currentDecoder && currentDecoder.state === 'closed') {
                        console.warn('解码器已关闭，将在下次收到数据时重新创建')
                        decoderConfiguredRef.current = false
                        decoderRef.current = null
                      }
                    },
                  })
                  decoderRef.current = currentDecoder
                }
                
                // 在配置解码器前检查其状态
                if (currentDecoder.state !== 'unconfigured') {
                  console.log(`解码器状态不是 unconfigured，当前状态: ${currentDecoder.state}`);
                  try {
                    currentDecoder.close();
                    // 重新创建一个新的解码器
                    currentDecoder = new VideoDecoder({
                      output: (frame) => {
                        try {
                          const { codedWidth, codedHeight } = frame
                          if (canvasRef.current) {
                            canvasRef.current.width = codedWidth
                            canvasRef.current.height = codedHeight
                          }
                          setSize({ width: codedWidth, height: codedHeight })
                          const canvasCtx = canvasRef.current?.getContext('2d');
                          if (canvasCtx && canvasRef.current) {
                            canvasCtx.drawImage(frame, 0, 0, codedWidth, codedHeight)
                          }
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
                        // 解码器遇到错误后状态会变成 closed，需要重新创建
                        const decoderInstance = decoderRef.current;
                        if (decoderInstance && decoderInstance.state === 'closed') {
                          console.warn('解码器已关闭，将在下次收到数据时重新创建')
                          decoderConfiguredRef.current = false
                          decoderRef.current = null
                        }
                      },
                    });
                    decoderRef.current = currentDecoder;
                  } catch (e) {
                    console.log('关闭解码器时出错:', e);
                  }
                }
                
                const fallbackCodec = 'avc1.42E01E'
                currentDecoder.configure({
                  codec: fallbackCodec,
                  codedWidth: 1920,
                  codedHeight: 1080,
                  hardwareAcceleration: 'prefer-hardware',
                })
                decoderConfiguredRef.current = true
                // 记录等待开始时间（使用对象存储）
                waitForIDRRef.current = { value: true, startTime: Date.now() } as any
                console.log(`✅ H264 解码器已使用默认配置: ${fallbackCodec}，等待 IDR 帧（如果5秒内未收到将尝试解码 P 帧）...`)
              } catch (defaultErr) {
                console.error('默认配置失败:', defaultErr)
                if (frameCounterRef.current > 20) {  // 减少错误前的等待时间
                  setError('解码器配置失败: 未找到 SPS/PPS 数据')
                  return
                }
              }
            } else {
              // 继续等待 SPS/PPS
              if (frameCounterRef.current <= 10) {
                console.log(`解码器未配置，已累积 ${spsPpsBufferRef.current.length} 字节，继续等待 SPS/PPS...`)
              }
              return
            }
          }
        }
        
        // 如果解码器仍未配置，跳过这个数据块
        if (!decoderConfiguredRef.current) {
          if (frameCounterRef.current <= 10) {
            console.log(`⏳ 解码器未配置，跳过数据块`)
          }
          return
        }
        
        // 如果解码器已关闭，需要重新创建
        let currentDecoder = decoderRef.current
        if (!currentDecoder || currentDecoder.state === 'closed') {
          console.warn('解码器已关闭，重新创建解码器')
          if (currentDecoder) {
            try {
              currentDecoder.close()
            } catch (e) {
              // 忽略关闭错误
            }
          }
          // 重新创建解码器
          const newDecoder = new VideoDecoder({
            output: (frame) => {
              try {
                const { codedWidth, codedHeight } = frame
                if (canvasRef.current) {
                  canvasRef.current.width = codedWidth
                  canvasRef.current.height = codedHeight
                }
                setSize({ width: codedWidth, height: codedHeight })
                if (ctx) {
                  ctx.drawImage(frame, 0, 0, codedWidth, codedHeight)
                }
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
              if (newDecoder.state === 'closed') {
                console.warn('解码器已关闭，将在下次收到数据时重新创建')
                decoderConfiguredRef.current = false
                decoderRef.current = null
              }
            },
          })
          decoderRef.current = newDecoder
          currentDecoder = newDecoder
          
          // 检查是否已经有SPS/PPS数据可用于配置解码器
          const { sps, pps } = extractSPSPPS(spsPpsBufferRef.current)
          if (sps && pps) {
            try {
              const spsLen = sps.length
              const ppsLen = pps.length
              const configSize = 8 + spsLen + 3 + ppsLen
              const description = new Uint8Array(configSize)
              
              let offset = 0
              description[offset++] = 0x01
              description[offset++] = sps[1]
              description[offset++] = sps[2]
              description[offset++] = sps[3]
              description[offset++] = 0xff
              description[offset++] = 0xe1
              description[offset++] = (spsLen >> 8) & 0xff
              description[offset++] = spsLen & 0xff
              description.set(sps, offset)
              offset += spsLen
              description[offset++] = 0x01
              description[offset++] = (ppsLen >> 8) & 0xff
              description[offset++] = ppsLen & 0xff
              description.set(pps, offset)
              
              // 从 SPS 提取 profile 和 level 信息
              const profileIdc = sps[1]
              const levelIdc = sps[3]
              const profileHex = profileIdc.toString(16).padStart(2, '0').toUpperCase()
              const levelHex = levelIdc.toString(16).padStart(2, '0').toUpperCase()
              const codecString = `avc1.${profileHex}00${levelHex}`
              
              // 在配置解码器前检查其状态
              if (newDecoder.state !== 'unconfigured') {
                console.log(`解码器状态不是 unconfigured，当前状态: ${newDecoder.state}`);
                try {
                  newDecoder.close();
                } catch (e) {
                  console.log('关闭解码器时出错:', e);
                }
              }
              
              newDecoder.configure({
                codec: codecString,
                codedWidth: 1920,
                codedHeight: 1080,
                description: description.buffer,
                hardwareAcceleration: 'prefer-hardware',
              })
              decoderConfiguredRef.current = true
              waitForIDRRef.current = true // 配置后需要等待 IDR 帧
              console.log('✅ H264 解码器已重新配置，等待 IDR 帧...')
            } catch (configErr) {
              console.error('重新配置解码器失败:', configErr)
            }
          }
        }
        
        // 累积数据到 NALU 缓冲区（处理可能被分割的 NALU）
        // 注意：后端发送的每个 NALU 都是完整的（包含 start code），但可能被 WebSocket/TCP 分割
        const combinedData = naluBufferRef.current.length > 0 
          ? new Uint8Array(naluBufferRef.current.length + data.length)
          : data
        
        if (naluBufferRef.current.length > 0) {
          combinedData.set(naluBufferRef.current, 0)
          combinedData.set(data, naluBufferRef.current.length)
          console.log(`📦 合并数据块，缓冲区: ${naluBufferRef.current.length} 字节 + 新数据: ${data.length} 字节 = ${combinedData.length} 字节`)
        }
        
        // 检查数据是否包含 start code（从开头查找）
        // 注意：screenrecord 可能发送大块数据，包含多个 NALU
        const hasStartCode4 = combinedData.length >= 4 && 
                             combinedData[0] === 0x00 && combinedData[1] === 0x00 && 
                             combinedData[2] === 0x00 && combinedData[3] === 0x01
        const hasStartCode3 = combinedData.length >= 3 && 
                             combinedData[0] === 0x00 && combinedData[1] === 0x00 && 
                             combinedData[2] === 0x01
        const hasStartCode = hasStartCode4 || hasStartCode3
        const startCodeLen = hasStartCode4 ? 4 : (hasStartCode3 ? 3 : 0)
        
        if (!hasStartCode) {
          // 如果累积的数据还没有 start code，继续累积
          // 注意：IDR 帧可能很大（20-30KB），所以需要足够大的缓冲区
          // 但 screenrecord 的数据块可能更大（50KB+），需要特殊处理
          if (combinedData.length < 100000) { // 增加到 100KB，适应 screenrecord
            naluBufferRef.current = combinedData
            // 减少日志输出频率，避免刷屏
            if (combinedData.length % 10000 === 0 || combinedData.length < 100) {
              console.log(`📦 数据块不包含 start code，累积到缓冲区（大小: ${combinedData.length} 字节）`)
            }
            return
          } else {
            // 如果数据很大但没有 start code，可能是数据损坏
            // 尝试在数据中查找 start code
            let foundStartCode = false
            for (let i = 0; i < Math.min(combinedData.length - 4, 10000); i++) {
              if ((combinedData[i] === 0x00 && combinedData[i+1] === 0x00 && 
                   combinedData[i+2] === 0x00 && combinedData[i+3] === 0x01) ||
                  (combinedData[i] === 0x00 && combinedData[i+1] === 0x00 && 
                   combinedData[i+2] === 0x01)) {
                console.log(`🔍 在位置 ${i} 找到 start code，重新对齐`)
                naluBufferRef.current = combinedData.slice(i)
                foundStartCode = true
                return
              }
            }
            if (!foundStartCode) {
              console.warn(`⚠️ 数据块不包含 start code 且数据较大（${combinedData.length} 字节），清空缓冲区`)
              naluBufferRef.current = new Uint8Array(0)
              return
            }
          }
        }
        
        // 检查 NALU 是否完整（至少要有 start code + NALU header）
        if (combinedData.length < startCodeLen + 1) {
          // 数据不完整，继续累积
          naluBufferRef.current = combinedData
          if (frameCounterRef.current <= 10) {
            console.log(`📦 NALU 数据不完整，累积到缓冲区（大小: ${combinedData.length} 字节）`)
          }
          return
        }
        
        // 查找下一个 start code，确定 NALU 的结束位置
        let naluEnd = combinedData.length
        for (let i = startCodeLen + 1; i < combinedData.length; i++) {
          const nextSc4 = i + 4 <= combinedData.length && 
                         combinedData[i] === 0x00 && combinedData[i + 1] === 0x00 && 
                         combinedData[i + 2] === 0x00 && combinedData[i + 3] === 0x01
          const nextSc3 = i + 3 <= combinedData.length && 
                         combinedData[i] === 0x00 && combinedData[i + 1] === 0x00 && 
                         combinedData[i + 2] === 0x01
          if (nextSc4 || nextSc3) {
            naluEnd = i
            break
          }
        }
        
        // 提取完整的 NALU（包含 start code）
        const completeNalu = combinedData.slice(0, naluEnd)
        // 保留剩余数据到缓冲区
        naluBufferRef.current = combinedData.slice(naluEnd)
        
        if (naluBufferRef.current.length > 0) {
          const dataBlockCount = (window as any).__h264DataBlockCount || 0
          if (dataBlockCount <= 10) {
            console.log(`📦 提取完整 NALU（${completeNalu.length} 字节），剩余数据（${naluBufferRef.current.length} 字节）保留到缓冲区`)
          }
        }
        
        // 使用完整的 NALU 数据（包含 start code）
        const naluData = completeNalu
        
        // 验证 NALU 数据格式
        if (naluData.length < startCodeLen + 1) {
          console.warn(`⚠️ NALU 数据太短（${naluData.length} 字节），跳过`)
          return
        }
        
        // 验证 start code
        const hasValidStartCode = (startCodeLen === 4 && naluData[0] === 0x00 && naluData[1] === 0x00 && naluData[2] === 0x00 && naluData[3] === 0x01) ||
                                  (startCodeLen === 3 && naluData[0] === 0x00 && naluData[1] === 0x00 && naluData[2] === 0x01)
        if (!hasValidStartCode) {
          console.warn(`⚠️ NALU 数据格式错误：start code 不正确，前${startCodeLen}字节: ${Array.from(naluData.slice(0, Math.min(startCodeLen + 4, naluData.length))).map(b => b.toString(16).padStart(2, '0')).join(' ')}`)
          return
        }
        
        // 检查 NALU 类型
        const naluType = (naluData[startCodeLen] & 0x1f)
        
        // 检查是否是关键帧（IDR 帧）
        const isKeyFrame = naluType === 5
        
        // 如果配置后等待 IDR 帧，只处理 IDR 帧（type 5）和 SPS/PPS（type 7/8）
        const waitState = waitForIDRRef.current as any
        // 修复：如果 waitState 是 false，isWaiting 应该是 false
        const isWaiting = waitState === false ? false : (typeof waitState === 'object' && waitState !== null ? waitState.value : waitState)
        if (isWaiting) {
          // 检查解码器状态，确保已配置完成
          const currentDecoder = decoderRef.current
          if (!currentDecoder || currentDecoder.state !== 'configured') {
            if (frameCounterRef.current <= 10) {
              console.log(`⏳ 等待解码器配置完成，当前状态: ${currentDecoder?.state || 'null'}，跳过 NALU 类型 ${naluType}`)
            }
            return
          }
          
          if (frameCounterRef.current <= 10) {
            const waitTime = typeof waitState === 'object' && waitState.startTime ? Math.floor((Date.now() - waitState.startTime) / 1000) : 0
            console.log(`⏳ 等待 IDR 帧，当前 NALU 类型: ${naluType}，大小: ${naluData.length} 字节，已等待: ${waitTime}秒`)
          }
          
          // 过滤掉无效的NALU（如类型16的SEI，只有4字节的可能是填充数据）
          if (naluType === 16 || (naluType === 0 && naluData.length <= 4)) {
            if (frameCounterRef.current <= 10) {
              console.log(`跳过无效 NALU（类型 ${naluType}，大小 ${naluData.length} 字节），等待 IDR 帧`)
            }
            return
          }
          
          if (naluType === 5) {
            // 收到 IDR 帧，可以开始解码
            // 清除等待状态（无论是什么格式）
            waitForIDRRef.current = false
            console.log(`✅ 收到 IDR 帧，开始解码（大小: ${naluData.length} 字节）`)
            console.log(`   解码器状态: ${decoderRef.current?.state}, 配置状态: ${decoderConfiguredRef.current}`)
            console.log(`   ⚠️ 重要：收到 IDR 帧后，后续 P 帧应该会被处理（waitForIDRRef 已设置为 false）`)
            // 验证解码器状态，如果已关闭，需要重新配置
            const currentDecoder = decoderRef.current
            if (!currentDecoder || currentDecoder.state !== 'configured') {
              console.warn(`⚠️ 收到 IDR 帧但解码器状态不正确（${currentDecoder?.state || 'null'}），需要重新配置`)
              // 不处理这个 IDR 帧，等待解码器重新配置
              return
            }
            // 继续处理，不要 return
          } else if (naluType === 7 || naluType === 8) {
            // SPS/PPS，跳过（已经在配置时处理过了）
            if (frameCounterRef.current <= 10) {
              console.log(`跳过 SPS/PPS (类型 ${naluType})，等待 IDR 帧`)
            }
            return
          } else {
            // 非 IDR 帧
            // 如果等待时间过长（超过3秒），强制开始解码 P 帧
            const waitStartTime = typeof waitState === 'object' && waitState !== null ? waitState.startTime : null
            if (waitStartTime && Date.now() - waitStartTime > 3000) {
              console.warn(`⚠️ 等待 IDR 帧超过3秒，强制开始解码（NALU类型: ${naluType}，大小: ${naluData.length} 字节）`)
              waitForIDRRef.current = false
              // 继续处理，不要 return
            } else {
              // 继续等待 IDR 帧
              if (frameCounterRef.current <= 10) {
                console.log(`等待 IDR 帧，跳过 NALU 类型 ${naluType}（大小: ${naluData.length} 字节）`)
              }
              return
            }
          }
        }
        
        // 检查是否还在等待 IDR 帧（修复后的逻辑）
        const currentWaitState = waitForIDRRef.current as any
        const stillWaiting = currentWaitState === false ? false : (typeof currentWaitState === 'object' && currentWaitState !== null ? currentWaitState.value : currentWaitState)
        if (stillWaiting && naluType !== 5) {
          // 如果还在等待 IDR 帧，但当前不是 IDR 帧，应该已经被上面的逻辑处理了
          // 这里不应该到达，但如果到达了，说明逻辑有问题
          console.warn(`⚠️ 逻辑错误：收到非 IDR 帧（类型 ${naluType}），但 waitForIDRRef 仍为 true，跳过`)
          return
        }
        
        try {
          // 递增时间戳（微秒，每帧约33ms，即33000微秒）
          timestampRef.current += 33000
          
          // 在投递帧之前检查解码器状态
          const finalDecoder = decoderRef.current;
          if (!finalDecoder) {
            console.warn('解码器不存在，跳过数据块');
            return;
          }
          
          // 检查是否还在等待 IDR 帧
          const currentWaitState = waitForIDRRef.current as any
          const stillWaiting = typeof currentWaitState === 'object' ? currentWaitState.value : currentWaitState
          if (stillWaiting && naluType !== 5) {
            // 如果还在等待 IDR 帧，但当前不是 IDR 帧，应该已经被上面的逻辑处理了
            // 这里不应该到达，但如果到达了，说明逻辑有问题
            console.warn(`⚠️ 逻辑错误：收到非 IDR 帧（类型 ${naluType}），但 waitForIDRRef 仍为 true`)
            return
          }
          
          if (finalDecoder.state !== 'configured') {
            console.warn('解码器状态不是 configured，当前状态:', finalDecoder.state, '跳过数据块')
            // 如果解码器未配置，尝试重新配置
            if (!decoderConfiguredRef.current) {
              console.log('🔄 解码器未配置，尝试重新配置...');
              // 重新寻找SPS/PPS并配置解码器
              const { sps, pps } = extractSPSPPS(spsPpsBufferRef.current);
              if (sps && pps) {
                console.log('🔧 重新找到 SPS/PPS，重新配置解码器');
                // 重建解码器
                if (finalDecoder.state !== 'closed') {
                  try {
                    finalDecoder.close();
                  } catch (e) {
                    console.log('关闭解码器时出错:', e);
                  }
                }
                
                // 创建新的解码器
                const newDecoder = new VideoDecoder({
                  output: (frame) => {
                    try {
                      const { codedWidth, codedHeight } = frame;
                      if (canvasRef.current) {
                        canvasRef.current.width = codedWidth;
                        canvasRef.current.height = codedHeight;
                      }
                      setSize({ width: codedWidth, height: codedHeight });
                      const canvasCtx = canvasRef.current?.getContext('2d');
                      if (canvasCtx && canvasRef.current) {
                        canvasCtx.drawImage(frame, 0, 0, codedWidth, codedHeight);
                      }
                      frameCounterRef.current += 1;
                      setFrames(frameCounterRef.current);
                    } catch (e) {
                      console.error('渲染帧失败:', e);
                    } finally {
                      frame.close();
                    }
                  },
                  error: (e) => {
                    console.error('解码错误 (重建后):', e);
                    const decoderInstance = decoderRef.current;
                    if (decoderInstance && decoderInstance.state === 'closed') {
                      console.warn('解码器已关闭 (重建后)，将在下次收到数据时重新创建');
                      decoderConfiguredRef.current = false;
                      decoderRef.current = null;
                    }
                  },
                });
                
                decoderRef.current = newDecoder;
                
                // 配置新的解码器
                try {
                  const spsLen = sps.length;
                  const ppsLen = pps.length;
                  const configSize = 8 + spsLen + 3 + ppsLen;
                  const description = new Uint8Array(configSize);
                  let offset = 0;
                  description[offset++] = 0x01;
                  description[offset++] = sps[1];
                  description[offset++] = sps[2];
                  description[offset++] = sps[3];
                  description[offset++] = 0xff;
                  description[offset++] = 0xe1;
                  description[offset++] = (spsLen >> 8) & 0xff;
                  description[offset++] = spsLen & 0xff;
                  description.set(sps, offset);
                  offset += spsLen;
                  description[offset++] = 0x01;
                  description[offset++] = (ppsLen >> 8) & 0xff;
                  description[offset++] = ppsLen & 0xff;
                  description.set(pps, offset);
                  
                  const fallbackCodec = 'avc1.42E01E'; // baseline 3.0
                  let codecString = fallbackCodec;
                  if (sps && sps.length >= 4) {
                    const profileIdc = sps[1];
                    const levelIdc = sps[3];
                    const profileHex = profileIdc.toString(16).padStart(2, '0').toUpperCase();
                    const levelHex = levelIdc.toString(16).padStart(2, '0').toUpperCase();
                    codecString = `avc1.${profileHex}00${levelHex}`;
                  }
                  
                  // 在配置解码器前检查其状态
                  if (newDecoder.state !== 'unconfigured') {
                    console.log(`解码器状态不是 unconfigured，当前状态: ${newDecoder.state}`);
                    try {
                      newDecoder.close();
                      // 重新创建一个新的解码器
                      const recreatedDecoder = new VideoDecoder({
                        output: (frame) => {
                          try {
                            const { codedWidth, codedHeight } = frame;
                            if (canvasRef.current) {
                              canvasRef.current.width = codedWidth;
                              canvasRef.current.height = codedHeight;
                            }
                            setSize({ width: codedWidth, height: codedHeight });
                            const canvasCtx = canvasRef.current?.getContext('2d');
                            if (canvasCtx && canvasRef.current) {
                              canvasCtx.drawImage(frame, 0, 0, codedWidth, codedHeight);
                            }
                            frameCounterRef.current += 1;
                            setFrames(frameCounterRef.current);
                          } catch (e) {
                            console.error('渲染帧失败:', e);
                          } finally {
                            frame.close();
                          }
                        },
                        error: (e) => {
                          console.error('解码错误 (重新创建后):', e);
                          const decoderInstance = decoderRef.current;
                          if (decoderInstance && decoderInstance.state === 'closed') {
                            console.warn('解码器已关闭 (重新创建后)，将在下次收到数据时重新创建');
                            decoderConfiguredRef.current = false;
                            decoderRef.current = null;
                          }
                        },
                      });
                      decoderRef.current = recreatedDecoder;
                      recreatedDecoder.configure({
                        codec: codecString,
                        codedWidth: 1920,
                        codedHeight: 1080,
                        hardwareAcceleration: 'prefer-hardware',
                        description: description.buffer,
                      });
                    } catch (e) {
                      console.log('关闭解码器时出错:', e);
                      // 使用默认配置
                      newDecoder.configure({
                        codec: fallbackCodec,
                        codedWidth: 1920,
                        codedHeight: 1080,
                        hardwareAcceleration: 'prefer-hardware',
                      });
                    }
                  } else {
                    newDecoder.configure({
                      codec: codecString,
                      codedWidth: 1920,
                      codedHeight: 1080,
                      hardwareAcceleration: 'prefer-hardware',
                      description: description.buffer,
                    });
                  }
                  
                  decoderConfiguredRef.current = true;
                  waitForIDRRef.current = true; // 配置后需要等待 IDR 帧
                  console.log(`✅ H264 解码器已重新配置 codec=${codecString} desc=${!!description.buffer}，等待 IDR 帧...`);
                } catch (configErr) {
                  console.error('重新配置解码器失败:', configErr);
                  // 使用默认配置
                  try {
                    const fallbackCodec = 'avc1.42E01E';
                    if (newDecoder.state !== 'unconfigured') {
                      try {
                        newDecoder.close();
                        // 重新创建一个新的解码器
                        const fallbackDecoder = new VideoDecoder({
                          output: (frame) => {
                            try {
                              const { codedWidth, codedHeight } = frame;
                              if (canvasRef.current) {
                                canvasRef.current.width = codedWidth;
                                canvasRef.current.height = codedHeight;
                              }
                              setSize({ width: codedWidth, height: codedHeight });
                              const canvasCtx = canvasRef.current?.getContext('2d');
                              if (canvasCtx && canvasRef.current) {
                                canvasCtx.drawImage(frame, 0, 0, codedWidth, codedHeight);
                              }
                              frameCounterRef.current += 1;
                              setFrames(frameCounterRef.current);
                            } catch (e) {
                              console.error('渲染帧失败:', e);
                            } finally {
                              frame.close();
                            }
                          },
                          error: (e) => {
                            console.error('解码错误 (fallback):', e);
                            const decoderInstance = decoderRef.current;
                            if (decoderInstance && decoderInstance.state === 'closed') {
                              console.warn('解码器已关闭 (fallback)，将在下次收到数据时重新创建');
                              decoderConfiguredRef.current = false;
                              decoderRef.current = null;
                            }
                          },
                        });
                        decoderRef.current = fallbackDecoder;
                        fallbackDecoder.configure({
                          codec: fallbackCodec,
                          codedWidth: 1920,
                          codedHeight: 1080,
                          hardwareAcceleration: 'prefer-hardware',
                        });
                      } catch (e) {
                        console.log('关闭解码器时出错:', e);
                        newDecoder.configure({
                          codec: fallbackCodec,
                          codedWidth: 1920,
                          codedHeight: 1080,
                          hardwareAcceleration: 'prefer-hardware',
                        });
                      }
                    } else {
                      newDecoder.configure({
                        codec: fallbackCodec,
                        codedWidth: 1920,
                        codedHeight: 1080,
                        hardwareAcceleration: 'prefer-hardware',
                      });
                    }
                    decoderConfiguredRef.current = true;
                    waitForIDRRef.current = true; // 配置后需要等待 IDR 帧
                    console.log(`✅ H264 解码器已使用默认配置: ${fallbackCodec}，等待 IDR 帧...`);
                  } catch (fallbackErr) {
                    console.error('默认配置失败:', fallbackErr);
                    setError('解码器配置失败: ' + String(fallbackErr));
                    return;
                  }
                }
              }
            }
            return;
          }
          
          // 再次检查解码器状态，确保已配置完成
          if (finalDecoder.state !== 'configured') {
            console.warn(`⚠️ 解码器状态不是 configured: ${finalDecoder.state}，跳过 NALU 类型 ${naluType}`)
            return
          }
          
          // 过滤掉无效的NALU（如类型16的SEI，只有4字节的可能是填充数据）
          if (naluType === 16 || (naluType === 0 && naluData.length <= 4)) {
            if (frameCounterRef.current <= 10) {
              console.log(`跳过无效 NALU（类型 ${naluType}，大小 ${naluData.length} 字节）`)
            }
            return
          }
          
          const chunk = new EncodedVideoChunk({
            type: isKeyFrame ? 'key' : 'delta',
            timestamp: timestampRef.current,
            data: naluData,
          })
          
          finalDecoder.decode(chunk)
          // 注意：frameCounterRef 只在解码器输出帧时才更新，所以这里显示的是"即将投递的帧序号"
          const dataBlockCount = (window as any).__h264DataBlockCount || 0
          // 减少日志输出频率，只在关键帧或每30帧输出一次
          if (isKeyFrame || dataBlockCount <= 10 || frameCounterRef.current <= 3 || frameCounterRef.current % 30 === 0) {
            console.log(`✅ 已投递 ${isKeyFrame ? 'key' : 'delta'} 帧到解码器（NALU类型: ${naluType}，大小: ${naluData.length} 字节，时间戳: ${timestampRef.current}，当前已解码帧数: ${frameCounterRef.current}）`)
          }
        } catch (e) {
          console.error('解码投喂失败:', e)
          console.error('   NALU类型:', naluType, '大小:', naluData.length, '时间戳:', timestampRef.current)
          console.error('   解码器状态:', decoderRef.current?.state)
          // 如果是解码器状态错误，标记需要重新配置
          if (String(e).includes('unconfigured') || String(e).includes('closed')) {
            decoderConfiguredRef.current = false
            decoderRef.current = null
            console.warn('解码器状态错误，已重置，等待重新配置')
          } else {
          setError(String(e))
          }
        }
      }

      ws.onerror = (e) => {
        console.error('H264 WebSocket 错误:', e)
        if (connectionTimeout) {
          clearTimeout(connectionTimeout)
          connectionTimeout = null
        }
        if (dataTimeout) {
          clearTimeout(dataTimeout)
          dataTimeout = null
        }
        setError('WebSocket 连接错误，请检查后端服务是否运行或切换到截图模式')
        setConnected(false)
      }

      ws.onclose = (event) => {
        console.log('H264 WebSocket 关闭', event.code, event.reason)
        if (connectionTimeout) {
          clearTimeout(connectionTimeout)
          connectionTimeout = null
        }
        if (dataTimeout) {
          clearTimeout(dataTimeout)
          dataTimeout = null
        }
        setConnected(false)
        if (event.code !== 1000) { // 非正常关闭
          const errorMsg = event.reason || `连接关闭 (代码: ${event.code})`
          setError(`WebSocket 连接关闭: ${errorMsg}，建议切换到截图模式`)
        } else {
          // 正常关闭时清除错误
          setError(null)
        }
      }

      // 返回清理函数
      cleanup = () => {
        // 防止重复清理
        if (isCleaningUp) {
          return
        }
        isCleaningUp = true
        
        console.log('H264 Player: 开始清理资源')
        
        if (connectionTimeout) {
          clearTimeout(connectionTimeout)
          connectionTimeout = null
        }
        if (dataTimeout) {
          clearTimeout(dataTimeout)
          dataTimeout = null
        }
        
        // 只有在 WebSocket 已连接或正在连接时才关闭
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
          try {
            ws.close(1000, 'Component unmounting')
            console.log('H264 Player: 已关闭 WebSocket 连接')
          } catch (e) {
            console.warn('关闭 WebSocket 失败:', e)
          }
        }
        
        // 只有在当前 WebSocket 是我们要关闭的那个时才清空引用
        if (wsRef.current === ws) {
        wsRef.current = null
        }
        
        try {
          if (decoderRef.current) {
            decoderRef.current.close()
            console.log('H264 Player: 已关闭视频解码器')
          }
        } catch (e) {
          console.warn('关闭解码器失败:', e)
        }
        decoderRef.current = null
        setConnected(false) // 重置连接状态
        setError(null) // 清除错误状态
        
        // 清除所有缓冲区
        spsPpsBufferRef.current = new Uint8Array(0)
        naluBufferRef.current = new Uint8Array(0)
        waitForIDRRef.current = false
        decoderConfiguredRef.current = false
        frameCounterRef.current = 0
        timestampRef.current = 0
        
        isCleaningUp = false
      }
    }
    
    // 开始检查 canvas
    checkCanvas()
    
    // 清理函数
    return () => {
      console.log('H264 Player: useEffect 清理函数被调用')
      if (cleanup) {
        cleanup()
      }
    }
  }, [deviceId, enabled]) // 移除 canvasRef 依赖，避免不必要的重新渲染

  return {
    supported: isWebCodecsSupported && connected, // 只有 WebCodecs 支持且已连接才返回 true
    error,
    stats: {
      frames,
      width: size.width,
      height: size.height,
    },
    updateConfig, // 导出 updateConfig 函数
  }
}

