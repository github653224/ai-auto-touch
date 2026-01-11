import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import { store } from './store'

// 全局样式
import 'antd/dist/reset.css'

// 注意：暂时禁用 StrictMode 以避免视频流组件的双重挂载问题
// 在生产环境中这不是问题，因为 StrictMode 只在开发模式下生效
ReactDOM.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <ConfigProvider locale={zhCN}>
          <App />
        </ConfigProvider>
      </BrowserRouter>
    </Provider>
  // </React.StrictMode>,
)

