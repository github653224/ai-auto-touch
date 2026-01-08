# mitmproxy 抓包功能集成方案

## 一、产品背景与目标

### 背景
- 当前平台支持 AI 控制和实时屏幕镜像，但缺少网络流量分析能力
- 研发和测试人员在测试 App 时，需要查看 HTTP/HTTPS 请求和响应
- mitmproxy 是成熟的中间人代理工具，提供 Web UI（mitmweb）和 API

### 目标
- 将 mitmproxy 集成到现有平台，提供统一的抓包体验
- 支持多设备独立抓包，互不干扰
- 提供直观的 Web 界面查看和分析流量
- 支持流量过滤、搜索、导出等功能

---

## 二、功能需求

### 2.1 核心功能

#### 1. 代理服务管理
- 为每个设备启动独立的 mitmproxy 实例（不同端口）
- 支持启动/停止代理服务
- 自动配置设备的 WiFi 代理设置
- 显示代理服务状态（运行中/已停止）

#### 2. 证书管理
- 自动生成 mitmproxy CA 证书
- 提供证书下载和安装指引
- 支持通过 ADB 推送证书到设备
- 检测设备证书安装状态

#### 3. 流量查看
- 嵌入 mitmweb 界面到平台页面（iframe）
- 实时显示 HTTP/HTTPS 请求列表
- 查看请求/响应详情（Headers、Body、Cookies 等）
- 支持 WebSocket 流量查看

#### 4. 流量过滤与搜索
- 按域名、路径、方法过滤
- 按状态码过滤（2xx、4xx、5xx）
- 全文搜索请求/响应内容
- 保存常用过滤规则

#### 5. 流量操作
- 导出流量数据（HAR 格式）
- 清空当前流量记录
- 重放请求（Replay）
- 修改请求/响应（Intercept）

### 2.2 高级功能（可选）

#### 1. 流量分析
- 统计请求数量、成功率
- 分析响应时间分布
- 识别慢请求和失败请求
- 生成流量报告

#### 2. Mock 功能
- 配置 Mock 规则
- 拦截特定请求并返回自定义响应
- 模拟网络异常（超时、断网）

#### 3. 脚本扩展
- 支持自定义 mitmproxy 脚本
- 实现自动化流量处理
- 集成到 CI/CD 流程

---

## 三、技术方案

### 3.1 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                      前端 (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  设备列表    │  │  屏幕镜像    │  │  抓包管理    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                          │                               │
│                          │ HTTP/WebSocket                │
└──────────────────────────┼───────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────┐
│                   后端 (FastAPI)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Device API   │  │ AI Control   │  │ Proxy API    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                            │             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Device Svc   │  │ AI Service   │  │ Proxy Svc    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                            │             │
└────────────────────────────────────────────┼─────────────┘
                                             │
                    ┌────────────────────────┼─────────────┐
                    │                        │             │
              ┌─────▼─────┐          ┌──────▼──────┐      │
              │ mitmproxy │          │  mitmweb    │      │
              │  (8081)   │          │   (8082)    │      │
              └───────────┘          └─────────────┘      │
                    │                                      │
                    │ Proxy                                │
              ┌─────▼─────┐                                │
              │  Android  │                                │
              │  Device   │                                │
              └───────────┘                                │
                                                           │
                    mitmproxy 进程管理                      │
                                                           │
└───────────────────────────────────────────────────────────┘
```

### 3.2 技术选型

**后端**：
- **mitmproxy**：核心代理引擎（Python）
- **mitmweb**：Web UI（内置于 mitmproxy）
- **mitmdump**：命令行工具，支持脚本扩展
- **FastAPI**：提供代理管理 API

**前端**：
- **iframe**：嵌入 mitmweb 界面
- **React**：代理管理界面
- **Ant Design**：UI 组件

**设备配置**：
- **ADB**：自动配置设备代理
- **WiFi Proxy**：通过 ADB 设置全局代理

### 3.3 端口分配策略

为避免端口冲突，采用动态端口分配：

| 服务 | 端口范围 | 说明 |
|------|---------|------|
| mitmproxy | 8081-8180 | 代理服务端口（每设备一个） |
| mitmweb | 8181-8280 | Web UI 端口（每设备一个） |

**端口分配规则**：
- 设备 1：mitmproxy=8081, mitmweb=8181
- 设备 2：mitmproxy=8082, mitmweb=8182
- 以此类推...

### 3.4 数据流程

**启动代理流程**：
1. 用户点击"启动抓包"
2. 后端为设备分配端口
3. 启动 mitmproxy 和 mitmweb 进程
4. 通过 ADB 配置设备 WiFi 代理
5. 返回 mitmweb URL 给前端
6. 前端在 iframe 中加载 mitmweb

**停止代理流程**：
1. 用户点击"停止抓包"
2. 后端停止 mitmproxy 进程
3. 通过 ADB 清除设备代理设置
4. 释放端口资源

**证书安装流程**：
1. 用户点击"安装证书"
2. 后端生成/获取 mitmproxy CA 证书
3. 通过 ADB 推送证书到设备
4. 提示用户在设备上安装证书

---

## 四、界面设计

### 4.1 页面结构

在现有页面基础上新增"抓包管理"页面：

```
设备列表页
├── 设备卡片
│   ├── 设备信息
│   ├── [查看屏幕] 按钮
│   ├── [AI 控制] 按钮
│   └── [抓包管理] 按钮 ← 新增
```

### 4.2 抓包管理页面布局

```
┌─────────────────────────────────────────────────────────┐
│  抓包管理 - 设备: Xiaomi 12                              │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │  代理状态                                        │   │
│  │  ● 运行中  端口: 8081  Web UI: 8181            │   │
│  │  [停止抓包]  [清空流量]  [导出 HAR]             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  证书管理                                        │   │
│  │  ✓ 证书已安装                                   │   │
│  │  [重新安装]  [下载证书]  [查看指引]             │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  mitmweb 界面                                    │   │
│  │  ┌───────────────────────────────────────────┐  │   │
│  │  │                                           │  │   │
│  │  │        [iframe: mitmweb UI]              │  │   │
│  │  │                                           │  │   │
│  │  │  显示请求列表、详情、过滤器等              │  │   │
│  │  │                                           │  │   │
│  │  └───────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 4.3 设备列表页集成

在设备卡片上新增"抓包"按钮和状态指示：

```
┌─────────────────────────────────┐
│  📱 Xiaomi 12                   │
│  序列号: ABC123                 │
│  系统: Android 13               │
│                                 │
│  [查看屏幕] [AI 控制] [抓包 🔴] │  ← 🔴 表示抓包中
└─────────────────────────────────┘
```

---

## 五、API 设计

### 5.1 代理管理 API

```python
# 启动代理
POST /api/v1/proxy/{device_id}/start
Response: {
    "success": true,
    "proxy_port": 8081,
    "web_port": 8181,
    "web_url": "http://localhost:8181",
    "message": "代理已启动"
}

# 停止代理
POST /api/v1/proxy/{device_id}/stop
Response: {
    "success": true,
    "message": "代理已停止"
}

# 获取代理状态
GET /api/v1/proxy/{device_id}/status
Response: {
    "running": true,
    "proxy_port": 8081,
    "web_port": 8181,
    "web_url": "http://localhost:8181",
    "request_count": 156,
    "uptime": "00:15:32"
}

# 清空流量
POST /api/v1/proxy/{device_id}/clear
Response: {
    "success": true,
    "message": "流量已清空"
}

# 导出流量
GET /api/v1/proxy/{device_id}/export?format=har
Response: HAR 文件下载
```

### 5.2 证书管理 API

```python
# 安装证书到设备
POST /api/v1/proxy/{device_id}/install-cert
Response: {
    "success": true,
    "message": "证书已推送到设备，请在设备上完成安装"
}

# 检查证书状态
GET /api/v1/proxy/{device_id}/cert-status
Response: {
    "installed": true,
    "cert_path": "/system/etc/security/cacerts/...",
    "expires_at": "2025-12-31"
}

# 下载证书
GET /api/v1/proxy/cert/download
Response: mitmproxy-ca-cert.pem 文件下载
```

---

## 六、实现要点

### 6.1 mitmproxy 进程管理

```python
# 伪代码示例
class ProxyService:
    def __init__(self):
        self.processes = {}  # device_id -> process
        self.ports = {}      # device_id -> (proxy_port, web_port)
    
    async def start_proxy(self, device_id: str):
        # 1. 分配端口
        proxy_port, web_port = self._allocate_ports(device_id)
        
        # 2. 启动 mitmweb
        cmd = [
            "mitmweb",
            "--listen-port", str(proxy_port),
            "--web-port", str(web_port),
            "--web-host", "0.0.0.0",
            "--set", "block_global=false"
        ]
        process = await asyncio.create_subprocess_exec(*cmd)
        
        # 3. 配置设备代理
        host_ip = self._get_host_ip()
        await self._set_device_proxy(device_id, host_ip, proxy_port)
        
        # 4. 保存进程信息
        self.processes[device_id] = process
        self.ports[device_id] = (proxy_port, web_port)
        
        return {
            "proxy_port": proxy_port,
            "web_port": web_port,
            "web_url": f"http://localhost:{web_port}"
        }
    
    async def _set_device_proxy(self, device_id: str, host: str, port: int):
        # 通过 ADB 设置全局代理
        await run_adb_command(
            f"-s {device_id} shell settings put global http_proxy {host}:{port}"
        )
```

### 6.2 证书安装

```python
async def install_certificate(self, device_id: str):
    # 1. 获取 mitmproxy 证书路径
    cert_path = os.path.expanduser("~/.mitmproxy/mitmproxy-ca-cert.pem")
    
    # 2. 转换为 Android 格式
    cert_hash = self._get_cert_hash(cert_path)
    android_cert_name = f"{cert_hash}.0"
    
    # 3. 推送到设备
    await run_adb_command(f"-s {device_id} push {cert_path} /sdcard/{android_cert_name}")
    
    # 4. 移动到系统证书目录（需要 root）
    # 或提示用户手动安装
    return {
        "success": True,
        "message": "请在设备上：设置 -> 安全 -> 从存储设备安装证书"
    }
```

### 6.3 前端集成

```typescript
// 抓包管理页面组件
const ProxyManagement: React.FC = () => {
  const [proxyStatus, setProxyStatus] = useState<ProxyStatus | null>(null);
  const [webUrl, setWebUrl] = useState<string>("");
  
  const startProxy = async () => {
    const response = await api.post(`/proxy/${deviceId}/start`);
    setProxyStatus(response.data);
    setWebUrl(response.data.web_url);
  };
  
  return (
    <div>
      <Card title="代理状态">
        {proxyStatus?.running ? (
          <>
            <Badge status="processing" text="运行中" />
            <Button onClick={stopProxy}>停止抓包</Button>
          </>
        ) : (
          <Button onClick={startProxy}>启动抓包</Button>
        )}
      </Card>
      
      {webUrl && (
        <Card title="mitmweb 界面">
          <iframe 
            src={webUrl} 
            style={{ width: '100%', height: '800px', border: 'none' }}
          />
        </Card>
      )}
    </div>
  );
};
```

---

## 七、开发计划

### 阶段一：基础功能（2-3 周）
- [ ] 后端：代理服务管理（启动/停止/状态查询）
- [ ] 后端：证书管理（生成/推送/安装）
- [ ] 后端：设备代理配置（ADB 自动设置）
- [ ] 前端：抓包管理页面
- [ ] 前端：mitmweb iframe 集成
- [ ] 测试：单设备抓包功能

### 阶段二：多设备支持（1-2 周）
- [ ] 后端：端口动态分配
- [ ] 后端：多进程管理
- [ ] 前端：设备列表抓包状态显示
- [ ] 测试：多设备并发抓包

### 阶段三：高级功能（2-3 周）
- [ ] 后端：流量导出（HAR 格式）
- [ ] 后端：流量统计分析
- [ ] 前端：流量过滤和搜索
- [ ] 前端：流量统计图表
- [ ] 测试：完整功能测试

### 阶段四：优化与文档（1 周）
- [ ] 性能优化
- [ ] 错误处理完善
- [ ] 用户文档编写
- [ ] API 文档更新

---

## 八、风险与挑战

### 技术风险

**1. HTTPS 解密**
- 问题：需要用户手动安装证书，体验不够流畅
- 解决：提供详细的安装指引和自动化脚本

**2. 端口冲突**
- 问题：多设备场景下端口管理复杂
- 解决：实现端口池管理，自动分配和回收

**3. 性能问题**
- 问题：大量流量可能影响代理性能
- 解决：限制流量记录数量，提供清空功能

### 用户体验风险

**1. 证书安装复杂**
- 问题：Android 证书安装需要多步操作
- 解决：提供图文指引，支持 ADB 自动推送

**2. 代理配置失效**
- 问题：设备重启后代理设置可能丢失
- 解决：提供一键重新配置功能

---

## 九、成功指标

### 功能指标
- 支持至少 10 台设备同时抓包
- 代理启动时间 < 3 秒
- 流量查看延迟 < 1 秒

### 用户体验指标
- 证书安装成功率 > 90%
- 用户满意度 > 4.5/5
- 功能使用率 > 60%

---

## 十、文件结构规划

```
backend/
├── app/
│   ├── api/
│   │   └── proxy_api.py              # 代理管理 API
│   ├── services/
│   │   ├── proxy_service.py          # 代理服务核心逻辑
│   │   └── cert_service.py           # 证书管理服务
│   ├── models/
│   │   └── proxy_models.py           # 代理相关数据模型
│   └── utils/
│       └── proxy_utils.py            # 代理工具函数

frontend/
├── src/
│   ├── pages/
│   │   └── ProxyManagement.tsx       # 抓包管理页面
│   ├── components/
│   │   ├── ProxyStatus.tsx           # 代理状态组件
│   │   ├── CertManager.tsx           # 证书管理组件
│   │   └── MitmwebViewer.tsx         # mitmweb 查看器
│   └── api/
│       └── proxyApi.ts               # 代理 API 客户端

docs/
└── MITM_PROXY_INTEGRATION.md         # 本文档
```

---

## 十一、参考资料

- [mitmproxy 官方文档](https://docs.mitmproxy.org/)
- [mitmweb 使用指南](https://docs.mitmproxy.org/stable/tools-mitmweb/)
- [Android 代理设置](https://developer.android.com/studio/command-line/adb#proxy)
- [HAR 格式规范](http://www.softwareishard.com/blog/har-12-spec/)

---

**文档版本**: v1.0  
**创建日期**: 2026-01-05  
**最后更新**: 2026-01-05  
**作者**: AI Auto Touch Team
