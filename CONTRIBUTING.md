# 贡献指南

感谢你对 AI Auto Touch 项目的关注！我们欢迎任何形式的贡献。

## 如何贡献

### 报告问题

如果你发现了 bug 或有功能建议：

1. 在 [Issues](https://github.com/your-username/ai-auto-touch/issues) 中搜索是否已有相关问题
2. 如果没有，创建新的 Issue，并提供：
   - 清晰的标题和描述
   - 复现步骤（如果是 bug）
   - 期望的行为
   - 实际的行为
   - 环境信息（操作系统、Python版本、Node版本等）

### 提交代码

1. **Fork 项目**
   ```bash
   # 点击 GitHub 页面右上角的 Fork 按钮
   ```

2. **克隆你的 Fork**
   ```bash
   git clone https://github.com/your-username/ai-auto-touch.git
   cd ai-auto-touch
   ```

3. **创建特性分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/your-bug-fix
   ```

4. **进行开发**
   - 遵循项目的代码风格
   - 添加必要的测试
   - 更新相关文档

5. **提交更改**
   ```bash
   git add .
   git commit -m "feat: 添加新功能描述"
   # 或
   git commit -m "fix: 修复某个bug"
   ```

   提交信息格式：
   - `feat:` 新功能
   - `fix:` Bug 修复
   - `docs:` 文档更新
   - `style:` 代码格式调整
   - `refactor:` 代码重构
   - `test:` 测试相关
   - `chore:` 构建/工具相关

6. **推送到你的 Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **创建 Pull Request**
   - 访问你的 Fork 页面
   - 点击 "New Pull Request"
   - 填写 PR 描述，说明你的更改
   - 等待维护者审核

## 开发规范

### 代码风格

**Python (Backend)**
- 遵循 PEP 8 规范
- 使用 4 空格缩进
- 函数和变量使用 snake_case
- 类名使用 PascalCase

**TypeScript/React (Frontend)**
- 使用 2 空格缩进
- 组件使用 PascalCase
- 函数和变量使用 camelCase
- 使用 TypeScript 类型注解

### 测试

- 为新功能添加测试
- 确保所有测试通过
- 保持测试覆盖率

### 文档

- 更新 README.md（如果需要）
- 为新功能添加使用说明
- 注释复杂的代码逻辑

## 行为准则

- 尊重所有贡献者
- 保持友好和专业
- 接受建设性的批评
- 关注项目的最佳利益

## 需要帮助？

如果你在贡献过程中遇到问题：

1. 查看项目文档
2. 在 Issues 中搜索相关问题
3. 创建新的 Issue 寻求帮助

感谢你的贡献！🎉