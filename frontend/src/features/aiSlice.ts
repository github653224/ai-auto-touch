import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { aiApi } from '../api/aiApi'

interface AIState {
  executing: boolean
  result: any
  error: string | null
  history: Array<{
    deviceId: string
    command: string
    result: any
    timestamp: number
  }>
}

const initialState: AIState = {
  executing: false,
  result: null,
  error: null,
  history: [],
}

// 执行自然语言指令
export const executeNLCommand = createAsyncThunk(
  'ai/executeCommand',
  async (
    { deviceId, command }: { deviceId: string; command: string },
    { rejectWithValue }
  ) => {
    try {
      const response = await aiApi.executeNLCommand(deviceId, { command })
      return {
        deviceId,
        command,
        result: response.data,
        timestamp: Date.now()
      }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || '执行指令失败')
    }
  }
)

// 批量执行指令
export const executeBatchCommand = createAsyncThunk(
  'ai/executeBatchCommand',
  async (
    commands: Array<{ deviceId: string; command: string }>,
    { rejectWithValue }
  ) => {
    try {
      const nlCommands = commands.map(cmd => ({
        device_id: cmd.deviceId,
        command: cmd.command,
        verbose: true
      }))
      const response = await aiApi.executeBatchCommand(nlCommands)
      return {
        results: response.data.results,
        timestamp: Date.now()
      }
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || '批量执行指令失败')
    }
  }
)

const aiSlice = createSlice({
  name: 'ai',
  initialState,
  reducers: {
    clearAIState: (state) => {
      state.executing = false
      state.result = null
      state.error = null
    },
    clearHistory: (state) => {
      state.history = []
    },
  },
  extraReducers: (builder) => {
    builder
      // 执行单个指令
      .addCase(executeNLCommand.pending, (state) => {
        state.executing = true
        state.error = null
      })
      .addCase(executeNLCommand.fulfilled, (state, action) => {
        state.executing = false
        state.result = action.payload.result
        state.history.push(action.payload)
      })
      .addCase(executeNLCommand.rejected, (state, action) => {
        state.executing = false
        state.error = action.payload as string
      })
      // 批量执行指令
      .addCase(executeBatchCommand.pending, (state) => {
        state.executing = true
        state.error = null
      })
      .addCase(executeBatchCommand.fulfilled, (state, action) => {
        state.executing = false
        state.result = action.payload.results
        // 添加到历史记录
        action.payload.results.forEach((result: any) => {
          state.history.push({
            deviceId: result.device_id,
            command: '',
            result,
            timestamp: action.payload.timestamp
          })
        })
      })
      .addCase(executeBatchCommand.rejected, (state, action) => {
        state.executing = false
        state.error = action.payload as string
      })
  },
})

export const { clearAIState, clearHistory } = aiSlice.actions
export default aiSlice.reducer

