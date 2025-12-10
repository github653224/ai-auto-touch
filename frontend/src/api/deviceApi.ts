import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

// 创建axios实例
const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 设备API
export const deviceApi = {
  // 获取所有设备
  getAllDevices: () => api.get('/devices'),
  
  // 扫描设备
  scanDevices: () => api.post('/devices/scan'),
  
  // 连接设备
  connectDevice: (deviceId: string) => api.post(`/devices/${deviceId}/connect`),
  
  // 断开设备
  disconnectDevice: (deviceId: string) => api.post(`/devices/${deviceId}/disconnect`),
  
  // 执行ADB命令
  executeCommand: (deviceId: string, command: string) => 
    api.post(`/devices/${deviceId}/command`, { command }),
}

