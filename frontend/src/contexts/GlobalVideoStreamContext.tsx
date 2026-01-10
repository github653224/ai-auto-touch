/**
 * 全局视频流上下文
 * 在应用层级维护单一的 ScrcpyPlayer 实例，避免页面切换时重新连接
 */

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { ScrcpyPlayer } from '../components/ScrcpyPlayer';

interface GlobalVideoStreamContextType {
  currentDeviceId: string | null;
  setCurrentDeviceId: (deviceId: string | null) => void;
  isVideoReady: boolean;
  videoError: string | null;
}

const GlobalVideoStreamContext = createContext<GlobalVideoStreamContextType | undefined>(undefined);

export const useGlobalVideoStream = () => {
  const context = useContext(GlobalVideoStreamContext);
  if (!context) {
    throw new Error('useGlobalVideoStream must be used within GlobalVideoStreamProvider');
  }
  return context;
};

interface GlobalVideoStreamProviderProps {
  children: React.ReactNode;
}

export const GlobalVideoStreamProvider: React.FC<GlobalVideoStreamProviderProps> = ({ children }) => {
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const playerKeyRef = useRef(0);

  // 当设备 ID 改变时，重置状态
  useEffect(() => {
    if (currentDeviceId) {
      setIsVideoReady(false);
      setVideoError(null);
      // 增加 key 以强制重新挂载（仅在设备切换时）
      playerKeyRef.current += 1;
    }
  }, [currentDeviceId]);

  const handleVideoReady = useCallback(() => {
    console.log('[GlobalVideoStream] 视频流已就绪');
    setIsVideoReady(true);
    setVideoError(null);
  }, []);

  const handleVideoError = useCallback((error: string) => {
    console.error('[GlobalVideoStream] 视频流错误:', error);
    setIsVideoReady(false);
    setVideoError(error);
  }, []);

  return (
    <GlobalVideoStreamContext.Provider
      value={{
        currentDeviceId,
        setCurrentDeviceId,
        isVideoReady,
        videoError,
      }}
    >
      {children}
      {/* 全局视频流播放器 - 始终挂载，通过 CSS 控制显示/隐藏 */}
      {currentDeviceId && (
        <div
          id="global-video-stream-container"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: -1,
            visibility: 'hidden',
          }}
        >
          <ScrcpyPlayer
            key={`global-${currentDeviceId}-${playerKeyRef.current}`}
            deviceId={currentDeviceId}
            maxSize={1280}
            bitRate={4_000_000}
            onReady={handleVideoReady}
            onError={handleVideoError}
          />
        </div>
      )}
    </GlobalVideoStreamContext.Provider>
  );
};
