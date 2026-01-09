/**
 * mitmproxy API 客户端
 */

const API_BASE_URL = '/api/v1/mitmproxy';

export interface MitmproxyStatus {
  status: 'online' | 'offline' | 'not_found';
  device_id: string;
  proxy_port?: number;
  web_port?: number;
  pid?: number;
  proxy_url?: string;
}

export interface MitmproxyStartResponse {
  success: boolean;
  device_id: string;
  proxy_port?: number;
  web_port?: number;
  proxy_url?: string;
  message: string;
}

/**
 * 启动设备的 mitmweb
 */
export const startMitmweb = async (deviceId: string): Promise<MitmproxyStartResponse> => {
  const response = await fetch(`${API_BASE_URL}/start/${deviceId}`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to start mitmweb: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * 停止设备的 mitmweb
 */
export const stopMitmweb = async (deviceId: string): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE_URL}/stop/${deviceId}`, {
    method: 'POST',
  });
  
  if (!response.ok) {
    throw new Error(`Failed to stop mitmweb: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * 获取设备的 mitmweb 状态
 */
export const getMitmwebStatus = async (deviceId: string): Promise<MitmproxyStatus> => {
  const response = await fetch(`${API_BASE_URL}/device/${deviceId}/status`);
  
  if (!response.ok) {
    throw new Error(`Failed to get mitmweb status: ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * 列出所有设备的 mitmweb
 */
export const listMitmwebDevices = async (): Promise<{ devices: MitmproxyStatus[] }> => {
  const response = await fetch(`${API_BASE_URL}/devices`);
  
  if (!response.ok) {
    throw new Error(`Failed to list devices: ${response.statusText}`);
  }
  
  return response.json();
};
