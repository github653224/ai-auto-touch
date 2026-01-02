import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'

// 创建axios实例
const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  timeout: 300000, // 增加到 5 分钟（300秒），适应远程 AI 模型的响应时间
  headers: {
    'Content-Type': 'application/json',
  },
})

// AI API
export const aiApi = {
  // 执行自然语言指令
  executeNLCommand: (deviceId: string, command: any) => 
    api.post(`/ai/command/${deviceId}`, command),
  
  // 批量执行指令
  executeBatchCommand: (commands: any[]) => 
    api.post('/ai/batch-command', commands),
  
  // 获取AI服务状态
  getAIStatus: () => api.get('/ai/status'),
}

