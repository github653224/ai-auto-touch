# mitmproxy 反向代理快速启动指南

## 🚀 快速开始

### 方式一：一键测试（推荐）

```bash
# 1. 启动 FastAPI 后端（在终端 1）
cd backend
source ~/miniconda3/etc/profile.d/conda.sh
conda activate ai-auto-touch
python main.py

# 2. 运行集成测试（在终端 2）
cd backend
bash test_mitmproxy_integration.sh
```

然后在浏览器中访问: http://localhost:8192/test_iframe_proxy.html

### 方式二：手动启动

```bash
# 1. 启动 mitmweb
bash backend/start_mitmweb_proxy.sh test-device 8091 8191

# 2. 启动 FastAPI（在另一个终端）
cd backend && python main.py

# 3. 注册设备
python backend/register_mitmweb.py register --device-id test-device

# 4. 测试
curl http://localhost:8000/api/v1/mitmproxy/device/test-device/status
```

## 📋 文件说明

### 核心文件

| 文件 | 说明 |
|------|------|
| `backend/app/api/mitmproxy_api.py` | FastAPI 反向代理 API |
| `backend/start_mitmweb_proxy.sh` | mitmweb 启动脚本 |
| `backend/register_mitmweb.py` | 设备注册工具 |
| `backend/test_mitmproxy_integration.sh` | 集成测试脚本 |

### 测试文件

| 文件 | 说明 |
|------|------|
| `backend/test_iframe_proxy.html` | 对比测试页面（推荐） |
| `backend/test_iframe.html` | 简单测试页面 |
| `backend/test_mitmweb.sh` | 旧版测试脚本（已废弃） |
| `backend/remove_frame_options.py` | 插件（不工作） |

### 文档

| 文件 | 说明 |
|------|------|
| `docs/MITM_PROXY_INTEGRATION_V2.md` | 完整方案文档 |
| `docs/MITMPROXY_PROXY_TESTING.md` | 详细测试指南 |
| `backend/MITMPROXY_QUICK_START.md` | 本文档 |

## 🔧 API 端点

### 反向代理访问

```
GET /api/v1/mitmproxy/proxy/{device_id}/{path}
```

**示例:**
```bash
# 访问 mitmweb 首页
curl http://localhost:8000/api/v1/mitmproxy/proxy/test-device/

# 在 iframe 中使用
<iframe src="http://localhost:8000/api/v1/mitmproxy/proxy/test-device/" />
```

### 设备管理

```bash
# 检查设备状态
curl http://localhost:8000/api/v1/mitmproxy/device/test-device/status

# 列出所有设备
curl http://localhost:8000/api/v1/mitmproxy/devices
```

## 🎯 前端集成

### React 组件

```typescript
const MitmproxyViewer: React.FC<{ deviceId: string }> = ({ deviceId }) => {
  return (
    <iframe
      src={`/api/v1/mitmproxy/proxy/${deviceId}/`}
      style={{ width: '100%', height: '800px', border: 'none' }}
      title="mitmproxy"
    />
  );
};
```

### 检查状态

```typescript
const status = await fetch(`/api/v1/mitmproxy/device/${deviceId}/status`)
  .then(res => res.json());

if (status.status === 'online') {
  console.log('mitmweb 在线');
}
```

## ❓ 常见问题

### Q1: iframe 显示空白？

**检查清单:**
```bash
# 1. mitmweb 是否运行？
ps aux | grep mitmweb

# 2. FastAPI 是否运行？
curl http://localhost:8000/

# 3. 设备是否注册？
curl http://localhost:8000/api/v1/mitmproxy/device/test-device/status
```

### Q2: 仍然显示 X-Frame-Options 错误？

确保使用反向代理 URL:
- ✅ 正确: `http://localhost:8000/api/v1/mitmproxy/proxy/test-device/`
- ❌ 错误: `http://localhost:8191/`

### Q3: 如何添加多个设备？

```bash
# 设备 1
bash start_mitmweb_proxy.sh device-1 8091 8191
python register_mitmweb.py register --device-id device-1 --web-port 8191

# 设备 2
bash start_mitmweb_proxy.sh device-2 8092 8192
python register_mitmweb.py register --device-id device-2 --web-port 8192
```

## 📚 更多信息

- **详细测试指南**: `docs/MITMPROXY_PROXY_TESTING.md`
- **完整方案文档**: `docs/MITM_PROXY_INTEGRATION_V2.md`
- **API 文档**: http://localhost:8000/docs

---

**版本**: v1.0  
**更新日期**: 2026-01-09
