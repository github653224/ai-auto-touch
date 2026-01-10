/**
 * 设备锁定 Hook
 * 自动管理设备的独占访问
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { message } from 'antd';

const API_BASE_URL = '/api/v1/device-lock';

interface LockInfo {
  session_id: string;
  user_id: string;
  user_name: string;
  locked_at: string;
  last_heartbeat: string;
  locked_duration: number;
}

interface UseDeviceLockOptions {
  deviceId: string | null;
  userId: string;
  userName: string;
  enabled?: boolean;
  heartbeatInterval?: number; // 心跳间隔（毫秒）
  onLockAcquired?: () => void;
  onLockLost?: () => void;
  onLockFailed?: (lockInfo: LockInfo) => void;
}

interface UseDeviceLockReturn {
  isLocked: boolean;
  sessionId: string | null;
  lockInfo: LockInfo | null;
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  forceAcquireLock: () => Promise<boolean>;
}

export const useDeviceLock = ({
  deviceId,
  userId,
  userName,
  enabled = true,
  heartbeatInterval = 15000, // 默认 15 秒
  onLockAcquired,
  onLockLost,
  onLockFailed,
}: UseDeviceLockOptions): UseDeviceLockReturn => {
  const [isLocked, setIsLocked] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lockInfo, setLockInfo] = useState<LockInfo | null>(null);
  const heartbeatTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAcquiringRef = useRef(false);

  // 获取锁
  const acquireLock = useCallback(async (force: boolean = false): Promise<boolean> => {
    if (!deviceId || !enabled) return false;
    if (isAcquiringRef.current) return false;

    isAcquiringRef.current = true;

    try {
      const response = await fetch(`${API_BASE_URL}/device/${deviceId}/acquire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          user_name: userName,
          force: force,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setIsLocked(true);
        setSessionId(data.session_id);
        setLockInfo(null);
        console.log(`[DeviceLock] 成功获取设备 ${deviceId} 的锁`);
        onLockAcquired?.();
        return true;
      } else {
        setIsLocked(false);
        setSessionId(null);
        setLockInfo(data.lock_info);
        console.warn(`[DeviceLock] 获取设备 ${deviceId} 的锁失败:`, data.message);
        onLockFailed?.(data.lock_info);
        return false;
      }
    } catch (error) {
      console.error('[DeviceLock] 获取锁时发生错误:', error);
      message.error('获取设备锁失败');
      return false;
    } finally {
      isAcquiringRef.current = false;
    }
  }, [deviceId, userId, userName, enabled, onLockAcquired, onLockFailed]);

  // 释放锁
  const releaseLock = useCallback(async () => {
    if (!deviceId || !sessionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/device/${deviceId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      const data = await response.json();

      if (data.success) {
        console.log(`[DeviceLock] 成功释放设备 ${deviceId} 的锁`);
      } else {
        console.warn(`[DeviceLock] 释放锁失败:`, data.message);
      }
    } catch (error) {
      console.error('[DeviceLock] 释放锁时发生错误:', error);
    } finally {
      setIsLocked(false);
      setSessionId(null);
      setLockInfo(null);
    }
  }, [deviceId, sessionId]);

  // 强制获取锁
  const forceAcquireLock = useCallback(async (): Promise<boolean> => {
    return acquireLock(true);
  }, [acquireLock]);

  // 发送心跳
  const sendHeartbeat = useCallback(async () => {
    if (!deviceId || !sessionId) return;

    try {
      const response = await fetch(`${API_BASE_URL}/device/${deviceId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });

      const data = await response.json();

      if (!data.success) {
        console.warn(`[DeviceLock] 心跳失败:`, data.message);
        
        if (data.should_disconnect) {
          // 锁已丢失，通知上层
          setIsLocked(false);
          setSessionId(null);
          message.warning('设备锁已丢失，可能被其他用户占用');
          onLockLost?.();
        }
      }
    } catch (error) {
      console.error('[DeviceLock] 发送心跳时发生错误:', error);
    }
  }, [deviceId, sessionId, onLockLost]);

  // 启动心跳定时器
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setInterval(() => {
      sendHeartbeat();
    }, heartbeatInterval);

    console.log(`[DeviceLock] 启动心跳定时器，间隔 ${heartbeatInterval}ms`);
  }, [sendHeartbeat, heartbeatInterval]);

  // 停止心跳定时器
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
      console.log('[DeviceLock] 停止心跳定时器');
    }
  }, []);

  // 自动获取锁（组件挂载时）
  useEffect(() => {
    if (deviceId && enabled) {
      acquireLock();
    }

    return () => {
      // 组件卸载时释放锁
      if (sessionId) {
        releaseLock();
      }
    };
  }, [deviceId, enabled]); // 注意：不包含 acquireLock 和 releaseLock，避免循环

  // 管理心跳
  useEffect(() => {
    if (isLocked && sessionId) {
      startHeartbeat();
    } else {
      stopHeartbeat();
    }

    return () => {
      stopHeartbeat();
    };
  }, [isLocked, sessionId, startHeartbeat, stopHeartbeat]);

  // 页面卸载时释放锁
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionId && deviceId) {
        // 使用 sendBeacon 确保请求发送
        const blob = new Blob(
          [JSON.stringify({ session_id: sessionId })],
          { type: 'application/json' }
        );
        navigator.sendBeacon(
          `${API_BASE_URL}/device/${deviceId}/release`,
          blob
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [sessionId, deviceId]);

  return {
    isLocked,
    sessionId,
    lockInfo,
    acquireLock: () => acquireLock(false),
    releaseLock,
    forceAcquireLock,
  };
};
