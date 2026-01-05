import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001'
const API_PREFIX = '/api/v1/control'

export interface TapRequest {
  x: number
  y: number
}

export interface SwipeRequest {
  x1: number
  y1: number
  x2: number
  y2: number
  duration?: number
}

export interface LongPressRequest {
  x: number
  y: number
  duration?: number
}

export interface TextInputRequest {
  text: string
}

export interface KeyPressRequest {
  keycode: string
}

export interface AppRequest {
  package_name: string
  activity?: string
}

export interface ScrollRequest {
  distance?: number
}

export const phoneControlApi = {
  // 基础控制
  tap: (deviceId: string, data: TapRequest) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/tap`, data),
  
  swipe: (deviceId: string, data: SwipeRequest) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/swipe`, data),
  
  longPress: (deviceId: string, data: LongPressRequest) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/long-press`, data),
  
  // 文本输入
  inputText: (deviceId: string, data: TextInputRequest) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/input-text`, data),
  
  clearText: (deviceId: string, count: number = 100) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/clear-text?count=${count}`),
  
  // 按键操作
  pressKey: (deviceId: string, data: KeyPressRequest) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/press-key`, data),
  
  pressHome: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/press-home`),
  
  pressBack: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/press-back`),
  
  pressMenu: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/press-menu`),
  
  pressPower: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/press-power`),
  
  pressVolumeUp: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/press-volume-up`),
  
  pressVolumeDown: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/press-volume-down`),
  
  pressEnter: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/press-enter`),
  
  pressAppSwitch: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/press-app-switch`),
  
  // 屏幕控制
  getScreenSize: (deviceId: string) =>
    axios.get(`${API_BASE_URL}${API_PREFIX}/${deviceId}/screen-size`),
  
  screenshot: (deviceId: string, savePath: string = '/sdcard/screenshot.png') =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/screenshot?save_path=${savePath}`),
  
  screenOn: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/screen-on`),
  
  screenOff: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/screen-off`),
  
  // 应用控制
  startApp: (deviceId: string, data: AppRequest) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/start-app`, data),
  
  stopApp: (deviceId: string, data: AppRequest) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/stop-app`, data),
  
  clearAppData: (deviceId: string, data: AppRequest) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/clear-app-data`, data),
  
  getCurrentApp: (deviceId: string) =>
    axios.get(`${API_BASE_URL}${API_PREFIX}/${deviceId}/current-app`),
  
  // 手势操作
  scrollUp: (deviceId: string, data: ScrollRequest = {}) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/scroll-up`, data),
  
  scrollDown: (deviceId: string, data: ScrollRequest = {}) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/scroll-down`, data),
  
  scrollLeft: (deviceId: string, data: ScrollRequest = {}) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/scroll-left`, data),
  
  scrollRight: (deviceId: string, data: ScrollRequest = {}) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/scroll-right`, data),
  
  // 系统操作
  unlockScreen: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/unlock-screen`),
  
  swipeDown: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/swipe-down`),
  
  openNotification: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/open-notification`),
  
  openQuickSettings: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/open-quick-settings`),
  
  closeNotification: (deviceId: string) =>
    axios.post(`${API_BASE_URL}${API_PREFIX}/${deviceId}/close-notification`),
}
