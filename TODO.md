# TODO List

## 功能开发

### 1. 录制回放功能（基于 AutoGLM-GUI）

**优先级**：中

**背景**：
- AutoGLM-GUI 已有轨迹记录功能（`TrajMemory`）
- 可以记录每一步的操作、截图、AI 思考过程
- 但缺少回放功能

**需求**：
实现操作录制和回放功能，避免重复调用 AI 模型浪费 token

**技术方案**：

#### 方案1：简单回放（推荐先实现）
```python
# 1. 保存轨迹到文件
def save_trajectory_to_file(agent, filename):
    traj_data = agent.save_traj()
    with open(filename, 'w') as f:
        json.dump(traj_data, f)

# 2. 回放轨迹
def replay_trajectory(filename, device_id):
    with open(filename, 'r') as f:
        traj_data = json.load(f)
    
    action_handler = ActionHandler(device_id=device_id)
    for step in traj_data['steps']:
        action_handler.handle_action(step['action'])
        time.sleep(1)
```

**优点**：
- ✅ 不需要调用 AI 模型
- ✅ 节省 token
- ✅ 执行速度快
- ✅ 可重复执行

**缺点**：
- ❌ UI 变化时可能失败
- ❌ 需要相同的起始状态

#### 方案2：脚本生成
将轨迹转换为可执行的 Python 脚本，方便修改和版本控制

#### 方案3：智能回放（后期优化）
先尝试直接执行，失败时调用 AI 重新决策

**实现步骤**：
1. [ ] 在后端添加轨迹保存 API
2. [ ] 在前端添加"保存录制"按钮
3. [ ] 实现轨迹管理界面（列表、查看、删除）
4. [ ] 实现回放功能
5. [ ] 添加回放控制（暂停、继续、停止）
6. [ ] 测试和优化

**相关文件**：
- `AutoGLM-GUI/mai_agent/unified_memory.py` - 轨迹数据结构
- `AutoGLM-GUI/mai_agent/base.py` - save_traj() 方法
- `AutoGLM-GUI/phone_agent/actions/handler.py` - 动作执行器

**预计工作量**：2-3 天

---

## Bug 修复

### 2. 视频流黑屏问题（当前最高优先级）

**优先级**：🔥 紧急

**状态**：调查中

**问题描述**：
- 页面切换时视频流黑屏
- 点击抓包页面后黑屏
- 重连按钮无效

**当前进展**：
- 已尝试多种方案（连接池、延迟断开等）
- 问题仍未解决
- 需要分析后端日志定位根本原因

**下一步**：
- [ ] 分析后端日志
- [ ] 使用 test_socket_connection.html 测试
- [ ] 定位是前端还是后端问题
- [ ] 实施针对性修复

---

## 已完成

### ✅ 网络抓包功能
- mitmweb 服务管理
- 自定义抓包界面
- 流量详情查看

### ✅ 设备锁定功能
- 多用户并发控制
- 心跳保活机制
- 自动释放锁

---

## 备注

- 录制回放功能可以显著减少 AI token 消耗
- 建议在视频流问题解决后再实施
- 可以先做一个简单的 MVP 验证可行性