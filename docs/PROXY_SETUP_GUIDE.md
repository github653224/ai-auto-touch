# 网络抓包代理设置指南

## 📖 概述

本文档介绍如何使用 mitmproxy 进行 Android 设备的网络抓包，包括代理设置、证书安装和使用方法。

## 🎯 使用流程

### 方式一：自动设置（推荐，开发中）

未来版本将支持一键自动配置：
1. 点击"设置代理"按钮 → 自动配置设备代理
2. 点击"安装证书"按钮 → 自动推送并安装证书
3. 点击"清除代理"按钮 → 恢复设备网络设置

### 方式二：手动设置（当前可用）

#### 步骤 1：启动 mitmproxy

进入抓包页面时，mitmproxy 会自动启动。你也可以手动启动：

```bash
# 查看设备 ID
adb devices

# 手动启动 mitmweb（如果需要）
cd backend
bash start_mitmweb_proxy.sh <设备ID> <代理端口> <Web端口>

# 示例
bash start_mitmweb_proxy.sh EP0110MZ0BC110733W 8091 8191
```

**端口说明**：
- 代理端口（8091）：手机流量通过此端口
- Web 端口（8191）：Web 界面端口（通过反向代理访问）

#### 步骤 2：获取电脑 IP 地址

**macOS / Linux:**
```bash
# 方式 1：查看所有网络接口
ifconfig

# 方式 2：只显示 IP 地址
ifconfig | grep "inet " | grep -v 127.0.0.1

# 方式 3：查看特定接口（WiFi）
ifconfig en0 | grep "inet "
```

**Windows:**
```cmd
ipconfig
```

**示例输出**：
```
inet 192.168.0.109 netmask 0xffffff00 broadcast 192.168.0.255
```

记下你的 IP 地址，例如：`192.168.0.109`

#### 步骤 3：在手机上设置代理

**Android 设置步骤**：

1. **打开 WiFi 设置**
   - 设置 → WLAN / WiFi
   - 长按当前连接的 WiFi 网络
   - 选择"修改网络"或"网络详情"

2. **配置代理**
   - 展开"高级选项"
   - 代理：选择"手动"
   - 代理服务器主机名：输入电脑 IP（如 `192.168.0.109`）
   - 代理服务器端口：输入代理端口（如 `8091`）
   - 点击"保存"

**通过 ADB 设置代理（推荐）**：

```bash
# 设置代理
adb shell settings put global http_proxy 192.168.0.109:8091

# 验证代理设置
adb shell settings get global http_proxy

# 清除代理
adb shell settings put global http_proxy :0
```

#### 步骤 4：安装 mitmproxy 证书

**为什么需要证书？**
- mitmproxy 需要解密 HTTPS 流量
- 没有证书只能看到 CONNECT 请求，无法查看详细内容

**安装步骤**：

1. **下载证书**
   
   在手机浏览器中访问：
   ```
   http://mitm.it
   ```
   
   或者直接下载证书文件：
   ```bash
   # 在电脑上生成证书
   mitmproxy
   # 按 q 退出，证书会生成在 ~/.mitmproxy/
   
   # 推送证书到手机
   adb push ~/.mitmproxy/mitmproxy-ca-cert.cer /sdcard/Download/
   ```

2. **安装证书到手机**
   
   **Android 11 及以上**：
   - 设置 → 安全 → 加密与凭据 → 安装证书
   - 选择"CA 证书"
   - 浏览到下载的证书文件
   - 输入锁屏密码确认安装
   
   **Android 10 及以下**：
   - 设置 → 安全 → 从存储设备安装
   - 选择证书文件
   - 输入证书名称（如 "mitmproxy"）
   - 点击"确定"

3. **验证证书安装**
   - 设置 → 安全 → 受信任的凭据
   - 切换到"用户"标签
   - 应该能看到 "mitmproxy" 证书

#### 步骤 5：开始抓包

1. **打开抓包页面**
   - 在设备列表中点击"抓包"按钮
   - 左侧显示手机屏幕，右侧显示 mitmproxy 界面

2. **操作手机**
   - 在左侧手机屏幕上操作
   - 或使用中间的控制按钮
   - 打开应用、浏览网页等

3. **查看抓包数据**
   - 右侧 mitmproxy 界面实时显示网络请求
   - 点击请求查看详细信息
   - 可以查看请求头、响应头、请求体、响应体等

## 🔍 使用技巧

### 1. 过滤请求

在 mitmproxy Web 界面中：
- 使用搜索框过滤 URL
- 点击"Filter"按钮设置高级过滤
- 常用过滤表达式：
  ```
  ~d example.com        # 只显示 example.com 的请求
  ~m POST               # 只显示 POST 请求
  ~s                    # 只显示服务器响应
  ~c 200                # 只显示状态码 200 的响应
  ```

### 2. 查看请求详情

- 点击任意请求进入详情页
- 切换标签查看：
  - Request：请求信息
  - Response：响应信息
  - Detail：详细信息
  - Headers：请求/响应头
  - Content：请求/响应体

### 3. 导出数据

```bash
# 保存抓包数据
# mitmproxy 会自动保存到 ~/.mitmproxy/flows

# 导出为 HAR 格式（可用于其他工具分析）
mitmdump -r ~/.mitmproxy/flows -w output.har
```

### 4. 重放请求

在 mitmproxy Web 界面中：
- 选择一个请求
- 点击"Replay"按钮
- 可以修改请求参数后重新发送

## ⚠️ 常见问题

### 1. 手机无法上网

**问题**：设置代理后手机无法访问网络

**原因**：
- 代理 IP 或端口配置错误
- mitmproxy 未启动
- 电脑和手机不在同一网络

**解决方案**：
```bash
# 1. 检查 mitmproxy 是否运行
ps aux | grep mitmproxy

# 2. 检查端口是否监听
lsof -i :8091

# 3. 检查防火墙设置（macOS）
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# 4. 临时关闭防火墙测试
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off

# 5. 验证网络连通性
ping 192.168.0.109  # 在手机终端或使用 ping 工具
```

### 2. 只能看到 CONNECT 请求

**问题**：mitmproxy 只显示 CONNECT 请求，看不到详细内容

**原因**：未安装或未信任 mitmproxy 证书

**解决方案**：
1. 确认证书已安装（设置 → 安全 → 受信任的凭据）
2. 确认证书在"用户"标签下，不是"系统"标签
3. 重新安装证书
4. 重启手机

### 3. 某些应用无法抓包

**问题**：部分应用（如银行、支付类）无法抓包

**原因**：
- 应用使用了证书固定（Certificate Pinning）
- 应用不信任用户安装的证书

**解决方案**：
- 使用 Xposed 或 Magisk 模块绕过证书固定
- 使用 Frida 动态 Hook
- 对于测试应用，可以修改 AndroidManifest.xml 添加网络安全配置

### 4. Android 7+ 应用不信任用户证书

**问题**：Android 7.0 及以上版本，应用默认不信任用户安装的证书

**解决方案**：

**方式 1：修改应用（需要重新打包）**
```xml
<!-- res/xml/network_security_config.xml -->
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config>
        <trust-anchors>
            <certificates src="system" />
            <certificates src="user" />
        </trust-anchors>
    </base-config>
</network-security-config>
```

**方式 2：使用系统证书（需要 Root）**
```bash
# 将证书安装到系统目录
adb root
adb remount
adb push mitmproxy-ca-cert.cer /system/etc/security/cacerts/
adb reboot
```

**方式 3：使用 Magisk 模块**
- 安装 "Move Certificates" 模块
- 自动将用户证书移动到系统证书目录

### 5. 代理设置后无法清除

**问题**：手动设置代理后，WiFi 设置中无法清除

**解决方案**：
```bash
# 通过 ADB 清除代理
adb shell settings put global http_proxy :0

# 或者重置网络设置
# 设置 → 系统 → 重置选项 → 重置 WiFi、移动数据和蓝牙
```

## 🛠️ 高级用法

### 1. 使用脚本修改请求/响应

创建 mitmproxy 脚本：

```python
# modify_response.py
from mitmproxy import http

def response(flow: http.HTTPFlow) -> None:
    # 修改响应内容
    if "api.example.com" in flow.request.pretty_url:
        flow.response.text = flow.response.text.replace("old", "new")
```

启动时加载脚本：
```bash
mitmweb -s modify_response.py --listen-port 8091 --web-port 8191
```

### 2. 保存所有请求

```bash
# 启动时自动保存
mitmweb --listen-port 8091 --web-port 8191 -w flows.mitm

# 后续可以回放
mitmweb -r flows.mitm
```

### 3. 透明代理模式（需要 Root）

```bash
# 在路由器或 Linux 主机上设置透明代理
mitmproxy --mode transparent --showhost

# 配置 iptables 重定向流量
iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 80 -j REDIRECT --to-port 8080
iptables -t nat -A PREROUTING -i wlan0 -p tcp --dport 443 -j REDIRECT --to-port 8080
```

## 📚 参考资料

- [mitmproxy 官方文档](https://docs.mitmproxy.org/)
- [Android 网络安全配置](https://developer.android.com/training/articles/security-config)
- [证书固定绕过方法](https://github.com/nabla-c0d3/ssl-kill-switch2)

## 🔄 未来功能

以下功能正在开发中：

- [ ] 一键设置设备代理
- [ ] 自动推送和安装证书
- [ ] 代理状态实时显示
- [ ] 证书有效期检查
- [ ] 支持多设备独立代理配置
- [ ] 抓包数据导出和分析

---

**文档版本**: v1.0  
**更新日期**: 2026-01-09  
**作者**: AI Auto Touch Team
