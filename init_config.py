#!/usr/bin/env python3
"""init_config.py
读取 litho_config.json 并把 machines / rules / tasks UPSERT 到 PostgreSQL。
运行方式：
    source .venv/bin/activate
    python init_config.py
"""
from __future__ import annotations
import asyncpg, asyncio, json, pathlib, logging
from typing import Any, Dict
from config import DATABASE_CONFIG

CONFIG_FILE = pathlib.Path('litho_config.json')
logging.basicConfig(level=logging.INFO, format='[init_config] %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

UPSERT_SQL = {
    'machines': """
        INSERT INTO machines (machine_id, machine_name, machine_type, mount_point, enabled, config)
        VALUES ($1,$2,$3,$4,$5,'{}')
        ON CONFLICT(machine_id) DO UPDATE
        SET machine_name = EXCLUDED.machine_name,
            machine_type = EXCLUDED.machine_type,
            mount_point  = EXCLUDED.mount_point,
            enabled      = EXCLUDED.enabled
    """,
    'rules': """
        INSERT INTO rules (rule_id, description, pattern, capture_group_names, type, plugin_func)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT(rule_id) DO UPDATE
        SET description = EXCLUDED.description,
            pattern     = EXCLUDED.pattern,
            capture_group_names = EXCLUDED.capture_group_names,
            type        = EXCLUDED.type,
            plugin_func = EXCLUDED.plugin_func
    """,
    'tasks': """
        INSERT INTO tasks (task_id, machine_id, task_name, source_path, apply_rules, post_processing)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT(task_id) DO UPDATE
        SET source_path   = EXCLUDED.source_path,
            apply_rules   = EXCLUDED.apply_rules,
            post_processing = EXCLUDED.post_processing
    """
}

async def main():
    if not CONFIG_FILE.exists():
        logger.error("%s not found", CONFIG_FILE)
        return
    cfg: Dict[str, Any] = json.loads(CONFIG_FILE.read_text())
    conn = await asyncpg.connect(**DATABASE_CONFIG)

    # machines
    for m in cfg.get('machines', []):
        await conn.execute(UPSERT_SQL['machines'], m['machine_id'], m['machine_name'],
                           m['machine_type'], m['mount_point'], m.get('enabled', True))
    # rules
    for r in cfg.get('rules', []):
        await conn.execute(UPSERT_SQL['rules'], r['rule_id'], r.get('description'),
                           r.get('pattern'), json.dumps(r.get('capture_group_names', [])),
                           r['type'], r.get('plugin_func'))
    # tasks
    for t in cfg.get('tasks', []):
        await conn.execute(UPSERT_SQL['tasks'], t['task_id'], t['machine_id'], t['task_name'],
                           t['source_path'], json.dumps(t['apply_rules']), json.dumps(t.get('post_processing', {})))
    await conn.close()
    logger.info("配置同步完成")

if __name__ == '__main__':
    asyncio.run(main()) 