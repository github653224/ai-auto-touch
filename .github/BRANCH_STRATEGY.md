# 分支管理策略

## 分支说明

### 主要分支

#### master
- **用途**: 生产环境分支，始终保持稳定可发布状态
- **保护**: 不允许直接推送，只能通过 PR 合并
- **来源**: 从 develop 或 hotfix 分支合并
- **命名**: `master`

#### develop
- **用途**: 开发主分支，日常开发的集成分支
- **保护**: 建议设置保护规则
- **来源**: 从 feature 和 bugfix 分支合并
- **命名**: `develop`

### 辅助分支

#### feature/*
- **用途**: 新功能开发
- **来源**: 从 develop 分支创建
- **合并到**: develop 分支
- **命名规则**: `feature/功能名称`
- **示例**: 
  - `feature/video-recording` - 视频录制功能
  - `feature/batch-control` - 批量控制功能
  - `feature/user-auth` - 用户认证功能

#### bugfix/*
- **用途**: Bug 修复
- **来源**: 从 develop 分支创建
- **合并到**: develop 分支
- **命名规则**: `bugfix/问题描述`
- **示例**:
  - `bugfix/video-stream-lag` - 修复视频流卡顿
  - `bugfix/device-disconnect` - 修复设备断连问题

#### hotfix/*
- **用途**: 紧急修复生产环境问题
- **来源**: 从 master 分支创建
- **合并到**: master 和 develop 分支
- **命名规则**: `hotfix/问题描述`
- **示例**:
  - `hotfix/critical-crash` - 修复严重崩溃
  - `hotfix/security-patch` - 安全补丁

## 工作流程

### 1. 开发新功能

```bash
# 1. 从 develop 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/new-feature

# 2. 开发和提交
git add .
git commit -m "feat: 添加新功能"

# 3. 推送到远程
git push -u origin feature/new-feature

# 4. 测试通过后，合并到 develop
git checkout develop
git merge --no-ff feature/new-feature
git push origin develop

# 5. 删除功能分支
git branch -d feature/new-feature
git push origin --delete feature/new-feature
```

### 2. 修复 Bug

```bash
# 1. 从 develop 创建修复分支
git checkout develop
git pull origin develop
git checkout -b bugfix/fix-issue

# 2. 修复和提交
git add .
git commit -m "fix: 修复问题描述"

# 3. 推送并合并
git push -u origin bugfix/fix-issue
git checkout develop
git merge --no-ff bugfix/fix-issue
git push origin develop
```

### 3. 发布到生产环境

```bash
# 1. 确保 develop 分支稳定
git checkout develop
git pull origin develop

# 2. 合并到 master
git checkout master
git pull origin master
git merge --no-ff develop
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin master --tags
```

### 4. 紧急修复

```bash
# 1. 从 master 创建 hotfix 分支
git checkout master
git pull origin master
git checkout -b hotfix/critical-fix

# 2. 修复和提交
git add .
git commit -m "hotfix: 紧急修复问题"

# 3. 合并到 master
git checkout master
git merge --no-ff hotfix/critical-fix
git tag -a v1.0.1 -m "Hotfix version 1.0.1"
git push origin master --tags

# 4. 合并到 develop
git checkout develop
git merge --no-ff hotfix/critical-fix
git push origin develop

# 5. 删除 hotfix 分支
git branch -d hotfix/critical-fix
git push origin --delete hotfix/critical-fix
```

## 提交信息规范

使用 Conventional Commits 规范：

- `feat:` - 新功能
- `fix:` - Bug 修复
- `docs:` - 文档更新
- `style:` - 代码格式调整（不影响功能）
- `refactor:` - 代码重构
- `perf:` - 性能优化
- `test:` - 测试相关
- `chore:` - 构建/工具链相关
- `ci:` - CI/CD 相关

**示例：**
```
feat: 添加视频录制功能
fix: 修复视频流断连问题
docs: 更新 README 安装说明
refactor: 优化设备管理服务
```

## 快速参考

```bash
# 查看所有分支
git branch -a

# 切换到 develop 分支
git checkout develop

# 创建新功能分支
git checkout -b feature/my-feature

# 更新当前分支
git pull origin $(git branch --show-current)

# 查看分支状态
git status

# 删除本地分支
git branch -d branch-name

# 删除远程分支
git push origin --delete branch-name
```

## 注意事项

1. **始终从最新的 develop 创建功能分支**
2. **定期从 develop 合并更新到功能分支**
3. **功能完成后及时合并并删除分支**
4. **使用有意义的分支名称和提交信息**
5. **develop 测试稳定后再合并到 master**
