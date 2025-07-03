#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
光刻机数据管理系统 - 主入口
集成Web服务和数据处理功能
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import json
import psycopg
import asyncpg
import concurrent.futures
from datetime import datetime
import pandas as pd
import numpy as np
import math

# 导入项目模块
from config import DATABASE_CONFIG, SYSTEM_CONFIG
from database import db_manager, init_database
from lusu_data_processor import LusuDataProcessor

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(title="光刻机数据管理系统", version="1.0.0")

# 挂载静态文件
app.mount("/static", StaticFiles(directory="static"), name="static")

# 设置模板
templates = Jinja2Templates(directory="templates")

# 全局资源，由 startup 创建
db_pool = None  # asyncpg.Pool
executor = None  # concurrent.futures.ProcessPoolExecutor
lusu_processor = None  # LusuDataProcessor

@app.on_event("startup")
async def startup():
    """启动时创建数据库连接池"""
    global db_pool, executor, lusu_processor

    # 数据库连接池
    db_pool = await asyncpg.create_pool(
        host=DATABASE_CONFIG['host'],
        port=DATABASE_CONFIG['port'],
        user=DATABASE_CONFIG['user'],
        password=DATABASE_CONFIG['password'],
        database=DATABASE_CONFIG['database'],
        min_size=5,
        max_size=20
    )
    logger.info("数据库连接池创建成功")
    
    # 创建进程池（重型计算）
    max_workers = SYSTEM_CONFIG.get('max_workers', 4)
    executor = concurrent.futures.ProcessPoolExecutor(max_workers=max_workers)
    logger.info(f"进程池创建成功, workers={max_workers}")

    # 初始化数据库
    init_database()

    # 构建 LUSU 处理器
    lusu_processor = LusuDataProcessor(db_pool=db_pool, executor=executor)
    logger.info("LUSU 处理器实例化完成")

@app.on_event("shutdown")
async def shutdown():
    """关闭数据库连接池"""
    global db_pool, executor
    if db_pool:
        await db_pool.close()
        logger.info("数据库连接池已关闭")
    if executor:
        executor.shutdown()
        logger.info("进程池已关闭")

@app.get("/", response_class=HTMLResponse)
async def dashboard(request: Request):
    """主仪表板页面"""
    return templates.TemplateResponse("dashboard.html", {"request": request})

@app.get("/api/machines")
async def get_machines():
    """获取所有机器列表"""
    async with db_pool.acquire() as conn:
        machines = await conn.fetch('''
            SELECT machine_id, machine_name, machine_type, enabled
            FROM machines
            ORDER BY machine_id
        ''')
        return [dict(machine) for machine in machines]

@app.get("/api/metrics/{machine_id}")
async def get_metrics(machine_id: str, limit: int = 100):
    """获取指定机器的指标数据"""
    async with db_pool.acquire() as conn:
        metrics = await conn.fetch('''
            SELECT 
                machine_id,
                metric_name,
                metric_value,
                record_timestamp,
                source_file
            FROM data_records 
            WHERE machine_id = $1
            ORDER BY record_timestamp DESC
            LIMIT $2
        ''', machine_id, limit)
        return [dict(metric) for metric in metrics]

@app.get("/api/metrics/{machine_id}/stats")
async def get_metrics_stats(machine_id: str):
    """获取指定机器的指标统计"""
    async with db_pool.acquire() as conn:
        stats = await conn.fetch('''
            SELECT 
                metric_name,
                COUNT(*) as record_count,
                MIN(record_timestamp) as first_record,
                MAX(record_timestamp) as last_record
            FROM data_records 
            WHERE machine_id = $1
            GROUP BY metric_name
            ORDER BY metric_name
        ''', machine_id)
        return [dict(stat) for stat in stats]

@app.get("/api/lusu/{machine_id}/processed")
async def get_lusu_processed_data(machine_id: str):
    """获取处理后的LUSU数据"""
    try:
        # 直接从数据库获取已处理数据
        df = await lusu_processor.get_lusu_data(machine_id=machine_id, limit=10000)
        
        if df.empty:
            return {"message": "没有LUSU数据", "data": []}
        
        # 转换为JSON格式（处理 NaN/Inf）
        data = df_to_safe_records(df)
        
        return {
            "message": "success",
            "data": data,
            "total_records": len(data)
        }
        
    except Exception as e:
        logger.error(f"获取LUSU数据失败: {e}")
        return {"message": f"获取数据失败: {str(e)}", "data": []}

@app.get("/api/lusu/{machine_id}/chart")
async def get_lusu_chart_data(machine_id: str, 
                             illumination_mode: str = None,
                             na: str = None,
                             sigma_inner: str = None,
                             sigma_outer: str = None):
    """获取LUSU图表数据，支持筛选"""
    try:
        # 获取数据
        df = await lusu_processor.get_lusu_data(machine_id=machine_id, limit=10000)
        
        if df.empty:
            return {"message": "没有LUSU数据", "chart_data": {}}
        
        # 应用筛选条件
        filters = {}
        if illumination_mode:
            filters['XT_Illumination Mode'] = [illumination_mode]
        if na:
            filters['XT_NA'] = [na]
        if sigma_inner:
            filters['XT_Sigma Inner'] = [sigma_inner]
        if sigma_outer:
            filters['XT_Sigma Outer'] = [sigma_outer]
        
        if filters:
            df = lusu_processor.filter_data(df, filters)
        
        # 生成图表数据
        raw_chart = lusu_processor.generate_chart_data(df)
        # 转换为 {metric: [[timestamp, value], ...]}
        transformed = {}
        if raw_chart and isinstance(raw_chart, dict):
            x_data = raw_chart.get('xAxis', {}).get('data', [])
            for series_item in raw_chart.get('series', []):
                name = series_item.get('name', 'value')
                y_list = series_item.get('data', [])
                pairs = []
                for idx, ts in enumerate(x_data):
                    y_val = y_list[idx] if idx < len(y_list) else None
                    pairs.append([ts, y_val])
                transformed[name] = pairs
        chart_data = _clean_value(transformed)
        
        return {
            "message": "success",
            "chart_data": chart_data,
            "filtered_records": len(df)
        }
        
    except Exception as e:
        logger.error(f"获取图表数据失败: {e}")
        return {"message": f"获取图表数据失败: {str(e)}", "chart_data": {}}

@app.post("/api/lusu/{machine_id}/save")
async def save_lusu_processed_data(machine_id: str):
    """重新处理并保存指定机器的LUSU数据到数据库"""
    try:
        # 重新执行数据处理（可能耗时较长）
        processed_count = await lusu_processor.process_lusu_data()
        
        return {
            "message": "success",
            "saved_records": processed_count
        }
        
    except Exception as e:
        logger.error(f"保存LUSU数据失败: {e}")
        return {"message": f"保存失败: {str(e)}"}

def check_dependencies():
    """检查依赖"""
    try:
        import psycopg
        import fastapi
        import uvicorn
        print("✓ 所有依赖已安装")
        return True
    except ImportError as e:
        print(f"✗ 缺少依赖: {e}")
        print("请运行: pip install -r requirements.txt")
        return False

def check_postgres():
    """检查PostgreSQL连接"""
    try:
        import psycopg
        
        conninfo = f"host={DATABASE_CONFIG['host']} " \
                  f"port={DATABASE_CONFIG['port']} " \
                  f"dbname={DATABASE_CONFIG['database']} " \
                  f"user={DATABASE_CONFIG['user']} " \
                  f"password={DATABASE_CONFIG['password']}"
        
        with psycopg.connect(conninfo) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version()")
                version = cur.fetchone()[0]
                print(f"✓ PostgreSQL连接成功: {version.split(',')[0]}")
                return True
    except Exception as e:
        print(f"✗ PostgreSQL连接失败: {e}")
        print("请确保PostgreSQL服务正在运行且配置正确")
        return False

def setup_environment():
    """设置环境"""
    # 创建必要目录
    Path("logs").mkdir(exist_ok=True)
    Path("static").mkdir(exist_ok=True)
    Path("data").mkdir(exist_ok=True)
    
    # 设置环境变量
    os.environ.setdefault('DB_HOST', DATABASE_CONFIG['host'])
    os.environ.setdefault('DB_PORT', str(DATABASE_CONFIG['port']))
    os.environ.setdefault('DB_NAME', DATABASE_CONFIG['database'])
    os.environ.setdefault('DB_USER', DATABASE_CONFIG['user'])
    os.environ.setdefault('DB_PASSWORD', DATABASE_CONFIG['password'])
    os.environ.setdefault('WEB_HOST', '0.0.0.0')
    os.environ.setdefault('WEB_PORT', '8000')

def start_data_collection():
    """启动数据收集任务"""
    if lusu_processor:
        asyncio.create_task(lusu_processor.process_lusu_data())
    logger.info("数据收集任务已启动")

# === 通用清洗函数（NaN/Inf -> None） ===

def _clean_value(v):
    """递归将 NaN/Inf 转换为 None，处理列表/字典/标量"""
    if isinstance(v, float):
        if math.isfinite(v):
            return v
        return None
    if isinstance(v, (np.floating, np.float32, np.float64)):
        if np.isfinite(v):
            return float(v)
        return None
    if isinstance(v, list):
        return [_clean_value(i) for i in v]
    if isinstance(v, dict):
        return {k: _clean_value(val) for k, val in v.items()}
    return v

# === 工具函数: DataFrame -> 安全 JSON ===

def df_to_safe_records(df: pd.DataFrame) -> list:
    """将 DataFrame 转换为严格 JSON 兼容的列表，处理 NaN/Inf"""
    if df.empty:
        return []
    sanitized = df.replace([np.inf, -np.inf], None)
    sanitized = sanitized.where(pd.notnull(sanitized), None)
    records = sanitized.to_dict('records')
    # 深度清洗
    return [_clean_value(rec) for rec in records]

if __name__ == "__main__":
    print("=== 光刻机数据管理系统 ===")
    print("版本: 1.0.0")
    print("环境: 精简版")
    print()
    
    # 检查依赖
    if not check_dependencies():
        sys.exit(1)
    
    # 设置环境
    setup_environment()
    
    # 检查数据库
    if not check_postgres():
        sys.exit(1)
    
    print()
    print("启动Web服务...")
    print("访问地址: http://localhost:8000")
    print("API文档: http://localhost:8000/docs")
    print("按 Ctrl+C 停止服务")
    print()
    
    try:
        # 启动FastAPI应用
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n服务已停止")
    except Exception as e:
        print(f"启动失败: {e}")
        sys.exit(1) 