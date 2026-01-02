# 开源发布前检查清单

## 📋 必须完成的任务

### 1. 代码清理 ✅

- [ ] 运行清理脚本: `bash cleanup.sh`
- [ ] 删除所有临时开发文档
- [ ] 删除注释的代码（特别是 ScreenDisplay.tsx 中的视频流代码）
- [ ] 删除未使用的文件和目录
- [ ] 删除 `auto-touch/` 目录
- [ ] 处理 `Open-AutoGLM/` 目录（改为 submodule 或删除）

### 2. 文档整理 ✅

- [ ] 整合手机控制文档到 `docs/PHONE_CONTROL.md`
- [ ] 删除重复的功能文档
- [ ] 更新 README.md
- [ ] 检查所有文档链接是否有效
- [ ] 添加文档索引 `docs/README.md`
- [ ] 添加截图和演示 GIF 到 `docs/images/`

### 3. 安全检查 🔒

- [ ] 删除所有 `.env` 文件（保留 `.env.example`）
- [ ] 检查代码中是否有硬编码的密钥或密码
- [ ] 检查 Git 历史中是否有敏感信息
- [ ] 更新 `.gitignore` 确保敏感文件不会被提交
- [ ] 确保 `models/` 目录不会被推送（已在 .gitignore）
- [ ] 运行大文件检查: `bash check_git_size.sh`
- [ ] 检查依赖包是否有安全漏洞

```bash
# 检查敏感信息
git log --all --full-history --source -- "*password*"
git log --all --full-history --source -- "*secret*"
git log --all --full-history --source -- "*api_key*"

# 检查 Python 依赖安全性
cd backend
pip install safety
safety check

# 检查 Node 依赖安全性
cd frontend
npm audit
```

### 4. 配置文件 ⚙️

- [ ] 创建 `backend/.env.example` 并填写示例配置
- [ ] 创建 `frontend/.env.example`（如果需要）
- [ ] 更新 `.gitignore`
- [ ] 检查 `docker-compose.yml`
- [ ] 添加 `.editorconfig`（可选）

### 5. 测试 🧪

- [ ] 后端测试通过: `cd backend && pytest`
- [ ] 前端测试通过: `cd frontend && npm test`
- [ ] 前端构建成功: `cd frontend && npm run build`
- [ ] 手动测试所有主要功能
- [ ] 测试 Docker 部署（如果提供）

### 6. 许可证和法律 📄

- [ ] 确认 LICENSE 文件存在且正确
- [ ] 检查所有依赖的许可证兼容性
- [ ] 添加版权声明到主要文件
- [ ] 确认没有侵犯第三方版权

### 7. GitHub 配置 🐙

- [ ] 创建 `.github/` 目录
- [ ] 添加 Issue 模板 `.github/ISSUE_TEMPLATE/`
- [ ] 添加 PR 模板 `.github/pull_request_template.md`
- [ ] 配置 GitHub Actions CI/CD `.github/workflows/`
- [ ] 添加 CODE_OF_CONDUCT.md
- [ ] 更新 CONTRIBUTING.md

### 8. 文档完善 📚

- [ ] README.md 包含所有必要信息
- [ ] 添加安装指南
- [ ] 添加使用示例
- [ ] 添加 API 文档
- [ ] 添加故障排除指南
- [ ] 添加贡献指南
- [ ] 添加更新日志 CHANGELOG.md

### 9. 版本管理 🏷️

- [ ] 更新版本号（package.json, setup.py 等）
- [ ] 创建 Git tag: `git tag v1.0.0`
- [ ] 准备 Release Notes

### 10. 最终检查 ✨

- [ ] 代码格式化: `black backend/` 和 `npm run format`
- [ ] 代码检查: `flake8 backend/` 和 `npm run lint`
- [ ] 拼写检查
- [ ] 链接检查
- [ ] 确保所有 TODO 已处理或记录

## 🚀 发布步骤

### 1. 创建备份

```bash
git checkout -b backup-before-release
git add .
git commit -m "Backup before release"
git push origin backup-before-release
```

### 2. 执行清理

```bash
# 运行清理脚本
bash cleanup.sh

# 检查更改
git status
git diff
```

### 3. 提交更改

```bash
git add .
git commit -m "chore: prepare for open source release

- Remove temporary development documents
- Consolidate documentation
- Clean up code
- Update README
- Add security checks
"
```

### 4. 创建 Release

```bash
# 创建标签
git tag -a v1.0.0 -m "Release v1.0.0"

# 推送到远程
git push origin main
git push origin v1.0.0
```

### 5. GitHub Release

1. 访问 GitHub 仓库
2. 点击 "Releases" → "Create a new release"
3. 选择标签 v1.0.0
4. 填写 Release 标题和说明
5. 上传必要的文件（如果有）
6. 发布

## 📝 Release Notes 模板

```markdown
# AI Auto Touch v1.0.0

## 🎉 首次发布

AI Auto Touch 是一个基于 AI 大模型的 Android 设备自动化控制平台。

### ✨ 主要功能

- 🤖 AI 智能控制 - 使用自然语言控制设备
- 📱 实时屏幕镜像 - 低延迟屏幕显示
- 🎯 批量设备管理 - 同时控制多台设备
- 🎨 现代化界面 - React + TypeScript
- 🔌 完整 API - RESTful + WebSocket

### 📦 安装

详见 [README.md](README.md) 和 [快速开始指南](docs/QUICK_START.md)

### 🐛 已知问题

- 暂无

### 🙏 致谢

感谢所有贡献者和支持者！

### 📄 许可证

MIT License
```

## 🔍 检查命令

```bash
# 检查文件结构
tree -L 2 -I 'node_modules|venv|__pycache__|.git|models'

# 检查文件大小
du -sh * --exclude=models

# 检查 Git 状态
git status

# 检查未跟踪的文件
git ls-files --others --exclude-standard

# 检查大文件（运行检查脚本）
bash check_git_size.sh

# 检查敏感文件
find . -name "*.env" -o -name "*secret*" -o -name "*password*"
```

## 📊 质量指标

- [ ] 代码覆盖率 > 70%
- [ ] 文档完整度 > 90%
- [ ] 无严重安全漏洞
- [ ] 无明显性能问题
- [ ] 所有主要功能可用

## 🎯 发布后任务

- [ ] 在社交媒体宣传
- [ ] 提交到 awesome 列表
- [ ] 写博客文章介绍项目
- [ ] 制作演示视频
- [ ] 监控 Issue 和 PR
- [ ] 收集用户反馈
- [ ] 规划下一个版本

## 📞 联系方式

如有问题，请联系：
- GitHub Issues: https://github.com/your-username/ai-auto-touch/issues
- Email: your-email@example.com

---

**最后更新**: 2026-01-02
**检查者**: [你的名字]
**状态**: 准备中 / 已完成
