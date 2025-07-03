# Litho-Database-Manage-System
This is my first coding project as an lithography engineer. Thanks to the golden era of AI for helping me get this idea off the ground~ It's a full stack database project for litho engineer.

# 光刻机数据管理系统

## 项目简介

光刻机数据管理系统是一个专为半导体制造厂光刻部门设计的数据收集、处理和可视化平台。系统支持从ASML PAS5500和Twinscan平台光刻机收集数据，进行处理分析，并通过Web界面展示关键指标。

## 系统架构

- **后端**：Python + FastAPI + PostgreSQL
- **前端**：HTML + CSS + JavaScript + ECharts
- **数据处理**：Pandas + NumPy
- **数据库**：PostgreSQL 18 (支持JSONB、异步IO)

## 目录结构

```
Project/
  ├── config.py                 # 全局配置
  ├── database.py               # 数据库操作
  ├── db_config_manager.py      # 数据库配置管理器
  ├── lusu_data_processor.py    # LUSU数据处理器
  ├── config_to_db.py           # 配置迁移工具
  ├── main.py                   # 主入口
  ├── requirements.txt          # 依赖项
  ├── static/                   # 静态资源
  │   ├── css/                  # 样式表
  │   └── js/                   # JavaScript文件
  └── templates/                # HTML模板
```

## 配置管理

系统采用两级配置管理：
1. **全局基础配置**：存储在`config.py`中，包括数据库连接、系统参数等
2. **结构化配置**：存储在PostgreSQL数据库的JSONB字段中，包括任务规则、任务模板、机器配置等

### 配置迁移

系统提供了配置迁移工具，可将`litho_dashboard_config.json`中的配置迁移到数据库：

```bash
# 迁移配置到数据库
python config_to_db.py
```

迁移后，系统会自动从数据库读取配置，无需修改JSON文件。

## 数据处理

系统支持使用Pandas和NumPy进行数据处理和分析：

```python
# 示例：使用pandas处理LUSU数据
df = await lusu_processor.get_lusu_data(machine_id="Twinscan_HPUVS24")
stats = df.groupby('illumination_mode')['uniformity'].agg(['mean', 'std', 'min', 'max'])
```

## 安装与运行

### 环境要求

- Python 3.9+
- PostgreSQL 14+

### 安装步骤

1. 克隆代码库
2. 创建虚拟环境
   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # 或
   venv\Scripts\activate  # Windows
   ```
3. 安装依赖
   ```bash
   pip install -r requirements.txt
   ```
4. 配置数据库
   ```bash
   # 创建数据库
   createdb litho_data
   
   # 创建用户并授权
   psql -c "CREATE USER litho_user WITH PASSWORD 'litho_password';"
   psql -c "GRANT ALL PRIVILEGES ON DATABASE litho_data TO litho_user;"
   ```
5. 迁移配置到数据库
   ```bash
   python config_to_db.py
   ```
6. 启动应用
   ```bash
   python main.py
   ```

## 使用说明

1. 访问Web界面：http://localhost:8000
2. 在仪表板中查看光刻机数据
3. 使用筛选器查看特定机器或参数的数据

## 开发指南

### 添加新任务

1. 在数据库中添加新的任务规则和模板
2. 更新相应的机器配置
3. 重启应用或调用API刷新配置

### 数据分析

系统支持使用Pandas和NumPy进行高级数据分析：

```python
# 示例：分析LUSU数据趋势
import pandas as pd
from db_config_manager import db_config
from lusu_data_processor import lusu_processor

async def analyze_trend():
    # 获取数据
    df = await lusu_processor.get_lusu_data(limit=10000)
    
    # 时间序列分析
    df['date'] = df['record_timestamp'].dt.date
    daily_avg = df.groupby('date')['uniformity'].mean()
    
    # 计算移动平均
    ma7 = daily_avg.rolling(window=7).mean()
    
    return ma7
```

## 核心特性

- **纯JSON配置**：所有配置信息存储在 `litho_dashboard_config.json` 中，Python代码中不保留具体配置
- **轻量级架构**：无Docker依赖，直接运行在RedHat Linux服务器上
- **异步数据库**：使用PostgreSQL 18和psycopg3实现高效异步数据访问
- **实时数据收集**：支持多种文件格式（日志、XML、CSV、图像）的实时收集
- **Web界面**：基于FastAPI的现代化Web界面，支持图表交互和数据导出
- **pgAdmin集成**：内置pgAdmin4用于数据库管理
- **性能优化**：针对HDD和网络瓶颈优化的数据收集策略

## 技术栈

- **后端**：Python 3.12 + FastAPI + psycopg3
- **数据库**：PostgreSQL 18（支持异步IO）
- **数据库管理**：pgAdmin4
- **配置管理**：纯JSON配置文件
- **数据收集**：异步文件监控和正则表达式解析
- **Web界面**：HTML5 + JavaScript + Chart.js

## 快速开始

### 1. 环境准备

```bash
# 安装Python 3.12
sudo yum install python3.12 python3.12-pip

# 安装PostgreSQL 18
sudo yum install postgresql18 postgresql18-server

# 安装pgAdmin4
sudo yum install pgadmin4
```

### 2. 安装依赖

```bash
pip3 install -r requirements.txt
```

### 3. 配置数据库

```bash
# 初始化PostgreSQL
sudo postgresql-18-setup initdb
sudo systemctl start postgresql-18
sudo systemctl enable postgresql-18

# 创建数据库和用户
sudo -u postgres psql
CREATE DATABASE litho_data;
CREATE USER litho_user WITH PASSWORD 'litho_password';
GRANT ALL PRIVILEGES ON DATABASE litho_data TO litho_user;
\q
```

### 4. 配置系统

编辑 `litho_dashboard_config.json` 文件：

```json
{
  "project_name": "Litho_Dashboard",
  "web_server_port": 8888,
  "database_path": "database/main_database.db",
  "web_output_path": "web_root/data.json",
  "log_settings": {
    "log_file": "logs/app.log",
    "level": "INFO"
  },
  "machines": [
    {
      "name": "Twinscan_HPUVS11",
      "enabled": true,
      "apply_tasks": ["Linux_Twinscan_Default"],
      "variables": {
        "mount_point": "/usr/asm/data.0000/data.HPUVS11"
      }
    }
  ]
}
```

### 5. 启动系统

```bash
# 启动主应用
python3 main.py

# 启动pgAdmin（可选）
sudo systemctl start pgadmin4
```

访问：
- 主应用：http://localhost:8888
- pgAdmin：http://localhost:5050

## 配置管理

### 添加/删除机器

直接编辑 `litho_dashboard_config.json` 文件：

```json
{
  "name": "Twinscan_HPUVS25",
  "enabled": true,
  "apply_tasks": ["Linux_Twinscan_Default"],
  "variables": {
    "mount_point": "/usr/asm/data.0000/data.HPUVS25"
  }
}
```

### 添加/删除任务

在JSON文件中添加新的任务模板和规则：

```json
"task_templates": {
  "New_Template": [
    {
      "task_name": "New_Task",
      "enabled": true,
      "task_type": "recursive_scan",
      "source_path": "{mount_point}/new/path/*.log",
      "apply_rules": ["NEW_RULE_1"]
    }
  ]
}
```

详细配置说明请参考 [CONFIG_GUIDE.md](CONFIG_GUIDE.md)。

## 项目结构

```
Project/
├── config.py                    # 配置管理器（从JSON读取）
├── main.py                      # 主应用程序
├── database.py                  # 数据库操作
├── run.py                       # 启动脚本
├── requirements.txt             # Python依赖
├── README.md                    # 项目说明
├── CONFIG_GUIDE.md              # 配置指南
├── database_schema.sql          # 数据库架构
├── litho_dashboard_config.json  # 主配置文件（根目录）
├── cleanup_dsb.py               # DSB文件夹清理工具
└── DSB/                         # 原始配置文件夹（可删除）
    └── configs/
        └── litho_dashboard_config.json  # 原始配置文件（已复制到根目录）
```

### 配置文件位置

- **主配置文件**: `litho_dashboard_config.json` (根目录)
- **原始配置文件**: `DSB/configs/litho_dashboard_config.json` (可删除)

### 清理DSB文件夹

当不再需要DSB文件夹时，可以使用清理工具：

```bash
python3 cleanup_dsb.py
```

清理工具会：
1. 检查配置文件状态
2. 备份重要文件（可选）
3. 安全删除DSB文件夹

## 数据收集策略

### 支持的文件类型
- **日志文件**：`.log` - 使用正则表达式解析
- **配置文件**：`.xml` - XML解析
- **数据文件**：`.csv` - CSV解析
- **图像文件**：`.png`, `.jpg`, `.tiff` - 图像分析
- **二进制文件**：`.cur` - 二进制数据解析

### 收集频率
- **实时数据**：每60秒收集一次
- **小时数据**：每小时收集一次
- **日常数据**：每天收集一次

### 性能优化
- **批量处理**：1000条记录批量插入
- **连接池**：20个数据库连接
- **异步处理**：非阻塞数据收集
- **数据压缩**：启用数据压缩节省存储空间

## 性能指标

### 系统要求
- **CPU**：4核心以上
- **内存**：8GB以上
- **存储**：HDD（针对网络和磁盘瓶颈优化）
- **网络**：千兆以太网

### 预期性能
- **数据收集**：50台机器，每台每秒处理1000条记录
- **数据库**：支持100万条记录/秒的插入
- **Web界面**：支持100个并发用户
- **响应时间**：查询响应时间 < 1秒

## 监控和维护

### 日志管理
- 应用日志：`logs/app.log`
- 数据库日志：PostgreSQL日志
- 系统日志：系统服务日志

### 数据备份
```bash
# 数据库备份
pg_dump litho_data > backup_$(date +%Y%m%d).sql

# 配置文件备份
cp litho_dashboard_config.json backup_config.json
```

### 性能监控
- CPU使用率监控
- 内存使用率监控
- 磁盘I/O监控
- 网络带宽监控

## 故障排除

### 常见问题
1. **配置加载失败**：检查JSON文件格式
2. **数据库连接失败**：检查PostgreSQL服务状态
3. **文件访问失败**：检查NFS挂载状态
4. **性能问题**：调整工作线程数和批处理大小

### 日志分析
```bash
# 查看应用日志
tail -f logs/app.log

# 查看系统日志
journalctl -u litho-dashboard -f
```

## 文档

- [配置指南](CONFIG_GUIDE.md) - 详细的配置说明
- [数据库架构](database_schema.sql) - 数据库表结构
- [API文档](http://localhost:8888/docs) - FastAPI自动生成的API文档

## 许可证

本项目采用MIT许可证。 
