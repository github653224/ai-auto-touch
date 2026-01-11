"""
Frida 服务 - 用于绕过 SSL Pinning
"""

import subprocess
import logging
from typing import Optional, Dict
from pathlib import Path

logger = logging.getLogger(__name__)


class FridaService:
    """Frida 服务管理类"""
    
    def __init__(self):
        self.frida_server_process: Optional[subprocess.Popen] = None
        
        # SSL Unpinning 脚本
        self.ssl_unpinning_script = """
// Universal SSL Pinning Bypass Script
// 适用于大多数 Android APP

Java.perform(function() {
    console.log("[*] SSL Pinning Bypass Started");
    
    // 1. 绕过 OkHttp3 的证书固定
    try {
        var CertificatePinner = Java.use('okhttp3.CertificatePinner');
        CertificatePinner.check.overload('java.lang.String', 'java.util.List').implementation = function(str, list) {
            console.log('[+] OkHttp3 CertificatePinner.check() bypassed');
            return;
        };
    } catch(e) {
        console.log('[-] OkHttp3 not found');
    }
    
    // 2. 绕过 TrustManager
    try {
        var X509TrustManager = Java.use('javax.net.ssl.X509TrustManager');
        var SSLContext = Java.use('javax.net.ssl.SSLContext');
        
        var TrustManager = Java.registerClass({
            name: 'com.sensepost.test.TrustManager',
            implements: [X509TrustManager],
            methods: {
                checkClientTrusted: function(chain, authType) {},
                checkServerTrusted: function(chain, authType) {},
                getAcceptedIssuers: function() {
                    return [];
                }
            }
        });
        
        var TrustManagers = [TrustManager.$new()];
        var SSLContext_init = SSLContext.init.overload(
            '[Ljavax.net.ssl.KeyManager;',
            '[Ljavax.net.ssl.TrustManager;',
            'java.security.SecureRandom'
        );
        
        SSLContext_init.implementation = function(keyManager, trustManager, secureRandom) {
            console.log('[+] SSLContext.init() bypassed');
            SSLContext_init.call(this, keyManager, TrustManagers, secureRandom);
        };
    } catch(e) {
        console.log('[-] TrustManager bypass failed: ' + e);
    }
    
    // 3. 绕过 WebView SSL 错误
    try {
        var WebViewClient = Java.use('android.webkit.WebViewClient');
        WebViewClient.onReceivedSslError.implementation = function(webView, sslErrorHandler, sslError) {
            console.log('[+] WebView SSL Error bypassed');
            sslErrorHandler.proceed();
        };
    } catch(e) {
        console.log('[-] WebView bypass failed');
    }
    
    console.log("[*] SSL Pinning Bypass Completed");
});
"""
    
    def check_frida_installed(self) -> bool:
        """检查 Frida 是否已安装"""
        try:
            result = subprocess.run(
                ['frida', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.returncode == 0
        except Exception:
            return False
    
    def check_frida_server_running(self, device_id: str) -> bool:
        """检查设备上的 Frida Server 是否在运行"""
        try:
            result = subprocess.run(
                ['adb', '-s', device_id, 'shell', 'ps', '|', 'grep', 'frida-server'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return 'frida-server' in result.stdout
        except Exception:
            return False
    
    def start_frida_server(self, device_id: str) -> Dict:
        """
        在设备上启动 Frida Server
        
        注意：需要先手动安装 frida-server 到设备
        """
        try:
            # 检查 frida-server 是否存在
            check_cmd = ['adb', '-s', device_id, 'shell', 'ls', '/data/local/tmp/frida-server']
            result = subprocess.run(check_cmd, capture_output=True, text=True, timeout=5)
            
            if result.returncode != 0:
                return {
                    "success": False,
                    "message": "frida-server not found on device. Please install it first."
                }
            
            # 启动 frida-server
            start_cmd = [
                'adb', '-s', device_id, 'shell',
                'su', '-c', '/data/local/tmp/frida-server &'
            ]
            
            subprocess.run(start_cmd, timeout=5)
            
            # 等待启动
            import time
            time.sleep(2)
            
            # 检查是否启动成功
            if self.check_frida_server_running(device_id):
                return {
                    "success": True,
                    "message": "Frida server started successfully"
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to start frida-server. Device may not be rooted."
                }
                
        except Exception as e:
            logger.error(f"启动 Frida Server 失败: {e}")
            return {
                "success": False,
                "message": str(e)
            }
    
    def inject_ssl_unpinning(self, device_id: str, package_name: str) -> Dict:
        """
        向指定 APP 注入 SSL Unpinning 脚本
        
        Args:
            device_id: 设备 ID
            package_name: APP 包名，如 'com.ss.android.article.news'
        """
        try:
            if not self.check_frida_installed():
                return {
                    "success": False,
                    "message": "Frida not installed. Run: pip install frida-tools"
                }
            
            if not self.check_frida_server_running(device_id):
                return {
                    "success": False,
                    "message": "Frida server not running on device"
                }
            
            # 保存脚本到临时文件
            script_file = Path("/tmp/ssl_unpinning.js")
            script_file.write_text(self.ssl_unpinning_script)
            
            # 使用 frida 注入脚本
            cmd = [
                'frida',
                '-U',  # USB 设备
                '-f', package_name,  # 启动 APP
                '-l', str(script_file),  # 加载脚本
                '--no-pause'
            ]
            
            logger.info(f"注入 SSL Unpinning: {' '.join(cmd)}")
            
            # 启动 frida 进程（后台运行）
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            self.frida_server_process = process
            
            return {
                "success": True,
                "message": f"SSL Unpinning injected into {package_name}",
                "pid": process.pid
            }
            
        except Exception as e:
            logger.error(f"注入 SSL Unpinning 失败: {e}")
            return {
                "success": False,
                "message": str(e)
            }
    
    def stop_injection(self) -> Dict:
        """停止 Frida 注入"""
        try:
            if self.frida_server_process:
                self.frida_server_process.terminate()
                self.frida_server_process = None
                return {
                    "success": True,
                    "message": "Frida injection stopped"
                }
            return {
                "success": False,
                "message": "No active injection"
            }
        except Exception as e:
            return {
                "success": False,
                "message": str(e)
            }


# 全局单例
_frida_service = None


def get_frida_service() -> FridaService:
    """获取 Frida 服务单例"""
    global _frida_service
    if _frida_service is None:
        _frida_service = FridaService()
    return _frida_service
