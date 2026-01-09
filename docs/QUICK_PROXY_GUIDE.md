# 抓包功能快速使用指南

## 🚀 5 分钟快速开始

### 第 1 步：进入抓包页面

1. 打开浏览器访问 http://localhost:3002
2. 在设备列表中找到你的设备
3. 点击"抓包"按钮

### 第 2 步：获取电脑 IP

```bash
# macOS / Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# 示例输出：inet 192.168.0.109
```

记下你的 IP 地址，例如：`192.168.0.109`

### 第 3 步：设置手机代理

**方式 1：通过 ADB（推荐）**

```bash
# 设置代理（替换为你的 IP 和端口）
adb shell settings put global http_proxy 192.168.0.109:8091

# 验证
adb shell settings get global http_proxy
```

**方式 2：手动设置**

1. 手机打开：设置 → WLAN
2. 长按当前 WiFi → 修改网络
3. 高级选项 → 代理：手动
4. 主机名：`192.168.0.109`（你的电脑 IP）
5. 端口：`8091`（抓包页面显示的代理端口）
6. 保存

### 第 4 步：安装证书

**下载证书**：

在手机浏览器访问：http://mitm.it

或通过 ADB 推送：
```bash
# 生成证书（如果还没有）
mitmproxy  # 启动后按 q 退出

# 推送到手机
adb push ~/.mitmproxy/mitmproxy-ca-cert.cer /sdcard/Download/
```

**安装证书**：

1. 设置 → 安全 → 加密与凭据
2. 安装证书 → CA 证书
3. 选择下载的证书文件
4. 输入锁屏密码确认

### 第 5 步：开始抓包

1. 在抓包页面左侧操作手机
2. 右侧 mitmproxy 界面实时显示网络请求
3. 点击请求查看详细信息

## ✅ 验证抓包是否成功

1. 在手机上打开浏览器
2. 访问任意网站（如 http://www.baidu.com）
3. 在 mitmproxy 界面应该能看到请求记录
4. 点击请求，能看到完整的请求和响应内容

## 🔧 快速故障排除

### 手机无法上网？

```bash
# 1. 检查 mitmproxy 是否运行
ps aux | grep mitmproxy

# 2. 检查端口
lsof -i :8091

# 3. 清除代理重试
adb shell settings put global http_proxy :0
```

### 只能看到 CONNECT 请求？

**原因**：证书未安装或未信任

**解决**：
1. 检查证书：设置 → 安全 → 受信任的凭据 → 用户
2. 确认能看到 "mitmproxy" 证书
3. 如果没有，重新安装证书

### 某些应用无法抓包？

**原因**：应用使用了证书固定（Certificate Pinning）

**解决**：
- 银行、支付类应用通常无法抓包（安全限制）
- 测试应用可以修改网络安全配置
- 使用 Frida 或 Xposed 绕过（高级用法）

## 📝 常用命令

```bash
# 设置代理
adb shell settings put global http_proxy <IP>:<PORT>

# 清除代理
adb shell settings put global http_proxy :0

# 查看当前代理
adb shell settings get global http_proxy

# 推送证书
adb push ~/.mitmproxy/mitmproxy-ca-cert.cer /sdcard/Download/

# 重启手机（某些情况需要）
adb reboot
```

## 🎯 使用技巧

### 1. 过滤特定域名

在 mitmproxy 搜索框输入：
```
~d api.example.com
```

### 2. 只看 POST 请求

```
~m POST
```

### 3. 只看错误响应

```
~c 4  # 4xx 错误
~c 5  # 5xx 错误
```

### 4. 组合过滤

```
~d api.example.com & ~m POST
```

## 📚 更多信息

- 📖 [完整代理设置指南](PROXY_SETUP_GUIDE.md)
- 🔧 [抓包功能实现文档](CAPTURE_PAGE_IMPLEMENTATION.md)
- 🌐 [mitmproxy 官方文档](https://docs.mitmproxy.org/)

## 💡 提示

- 抓包完成后记得清除代理，恢复正常网络
- 证书只需安装一次，后续可以直接使用
- 电脑和手机必须在同一 WiFi 网络
- 某些公司或学校网络可能限制代理使用

---

**快速帮助**: 如有问题，请查看 [完整故障排除指南](PROXY_SETUP_GUIDE.md#常见问题)
