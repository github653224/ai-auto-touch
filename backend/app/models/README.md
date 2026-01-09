# Models 目录说明

此目录包含项目的核心数据模型定义，属于私有代码。

## 获取完整代码

完整代码存储在私有仓库中。如果你是项目成员，请按以下步骤获取：

### 方式一：克隆私有仓库（推荐）

```bash
# 克隆完整的私有仓库
git clone git@github.com:github653224/ai-auto-touch-all.git
cd ai-auto-touch-all
```

### 方式二：从私有仓库获取 models 目录

```bash
# 在当前项目目录下
git remote add private git@github.com:github653224/ai-auto-touch-all.git
git fetch private
git checkout private/develop -- backend/app/models/
```

## 目录结构

```
backend/app/models/
├── __init__.py          # 包初始化文件
├── ai_models.py         # AI 请求/响应数据模型
└── device_models.py     # 设备信息数据模型
```

## 依赖说明

以下模块依赖此目录：
- `backend/app/api/ai_api.py`
- `backend/app/api/device_api.py`
- `backend/app/services/device_service.py`

## 注意事项

⚠️ **此目录为项目必需文件，缺少将导致项目无法运行**

如果你没有访问私有仓库的权限，请联系项目维护者。
