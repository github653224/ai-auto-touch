import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { deviceApi } from '../api/deviceApi'

export interface DeviceInfo {
  device_id: string
  name?: string
  model?: string
  android_version?: string
  status: string
  screen_size?: string
  battery?: number
}

interface DeviceState {
  devices: DeviceInfo[]
  loading: boolean
  error: string | null
  selectedDevice: string | null
}

const initialState: DeviceState = {
  devices: [],
  loading: false,
  error: null,
  selectedDevice: null,
}

// 异步操作：获取所有设备
export const fetchDevices = createAsyncThunk(
  'devices/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await deviceApi.getAllDevices()
      return response.data
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || '获取设备列表失败')
    }
  }
)

// 异步操作：扫描设备
export const scanDevices = createAsyncThunk(
  'devices/scan',
  async (_, { rejectWithValue }) => {
    try {
      const response = await deviceApi.scanDevices()
      return response.data.devices
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || '扫描设备失败')
    }
  }
)

// 异步操作：连接设备
export const connectDevice = createAsyncThunk(
  'devices/connect',
  async (deviceId: string, { rejectWithValue }) => {
    try {
      const response = await deviceApi.connectDevice(deviceId)
      return { deviceId, success: response.data.success }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || '连接设备失败')
    }
  }
)

// 异步操作：断开设备
export const disconnectDevice = createAsyncThunk(
  'devices/disconnect',
  async (deviceId: string, { rejectWithValue }) => {
    try {
      const response = await deviceApi.disconnectDevice(deviceId)
      return { deviceId, success: response.data.success }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || '断开设备失败')
    }
  }
)

const deviceSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {
    selectDevice: (state, action: PayloadAction<string | null>) => {
      state.selectedDevice = action.payload
    },
    clearError: (state) => {
      state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取设备列表
      .addCase(fetchDevices.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchDevices.fulfilled, (state, action) => {
        state.loading = false
        state.devices = action.payload
      })
      .addCase(fetchDevices.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // 扫描设备
      .addCase(scanDevices.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(scanDevices.fulfilled, (state, action) => {
        state.loading = false
        state.devices = action.payload
      })
      .addCase(scanDevices.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // 连接设备
      .addCase(connectDevice.fulfilled, (state, action) => {
        const { deviceId, success } = action.payload
        if (success) {
          const device = state.devices.find(d => d.device_id === deviceId)
          if (device) {
            device.status = 'connected'
          }
        }
      })
      // 断开设备
      .addCase(disconnectDevice.fulfilled, (state, action) => {
        const { deviceId, success } = action.payload
        if (success) {
          const device = state.devices.find(d => d.device_id === deviceId)
          if (device) {
            device.status = 'disconnected'
          }
        }
      })
  },
})

export const { selectDevice, clearError } = deviceSlice.actions
export default deviceSlice.reducer

