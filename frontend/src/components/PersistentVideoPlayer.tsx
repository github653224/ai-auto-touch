/**
 * 持久化视频播放器
 * 不会随路由切换而卸载，通过 CSS 控制显示/隐藏
 */

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { ScrcpyPlayer } from './ScrcpyPlayer'

interface PersistentVideoPlayerProps {
  deviceId: string | null
  maxSize?: number
  bitRate?: number
  onReady?: () => void
  onError?: (error: string) => void
}

export const PersistentVideoPlayer: React.FC<PersistentVideoPlayerProps> = ({
  deviceId,
  maxSize = 1280,
  bitRate = 4_000_000,
  onReady,
  onError,
}) => {
  const location = useLocation()
  const containerRef = useRef<HTMLDivElement>(null)

  // 判断当前路由是否需要显示视频流
  const shouldShowVideo = () => {
    const path = location.pathname
    return path.includes('/screen') || path.includes('/ai') || path.includes('/capture')
  }

  // 根据路由更新容器的显示状态
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current
      if (shouldShowVideo() && deviceId) {
        container.style.display = 'block'
      } else {
        container.style.display = 'none'
      }
    }
  }, [location.pathname, deviceId])

  if (!deviceId) {
    return null
  }

  return (
    <div
      ref={containerRef}
      id="persistent-video-player"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: -1,
        display: 'none',
      }}
    >
      <ScrcpyPlayer
        key={deviceId}
        deviceId={deviceId}
        maxSize={maxSize}
        bitRate={bitRate}
        onReady={onReady}
        onError={onError}
      />
    </div>
  )
}