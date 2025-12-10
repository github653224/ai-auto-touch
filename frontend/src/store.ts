import { configureStore } from '@reduxjs/toolkit'
import deviceReducer from './features/deviceSlice'
import aiReducer from './features/aiSlice'

export const store = configureStore({
  reducer: {
    devices: deviceReducer,
    ai: aiReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

