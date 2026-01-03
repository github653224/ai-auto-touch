import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { ScrcpyPlayer } from '../components/ScrcpyPlayer'
import { message } from 'antd'

interface VideoStreamContextType {
  showVideoStream: boolean
  setShowVideoStream: (show: boolean) => void
}

const VideoStreamContext = createContext<VideoStreamContextType | undefined>(undefined)

export const useVideoStream = () => {
  const context = useContext(VideoStreamContext)
  if (!context) {
    throw new Error('useVideoStream must be used within VideoStreamProvider')
  }
  return context
}

interface VideoStreamProviderProps {
  children: ReactNode
  deviceId: string | null
}

export const VideoStreamProvider = ({ children, deviceId }: VideoStreamProviderProps) => {
  const [showVideoStream, setShowVideoStream] = useState(false)

  const handleVideoReady = useCallback(() => {
    console.log('全局视频流已连接')
  }, [])

  const handleVideoError = useCallback((err: string) => {
    console.error('全局视频流错误:', err)
    message.error(`视频流错误: ${err}`)
  }, [])

  return (
    <VideoStreamContext.Provider value={{ showVideoStream, setShowVideoStream }}>
      {children}
      {/* 全局视频流组件，始终挂载但可以隐藏 */}
      {deviceId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 9999,
            pointerEvents: 'none',
            display: showVideoStream ? 'block' : 'none',
          }}
        >
          <ScrcpyPlayer
            deviceId={deviceId}
            maxSize={1080}
            bitRate={4_000_000}
            onReady={handleVideoReady}
            onError={handleVideoError}
          />
        </div>
      )}
    </VideoStreamContext.Provider>
  )
}
