#!/usr/bin/env python3
"""parsers.py  
集中存放所有文件解析函数。
新增任务 → 只需在此文件追加 parse_* 函数，并在 JSON 配置里引用即可。
"""

from __future__ import annotations
import datetime as _dt
import json as _json
import re as _re
from typing import Dict, Any

# 通用 TAG 行解析正则：TAG|TYPE|UNIT|VALUE  (VALUE 允许包含竖线，因此使用 3 次分隔)
_TAG_RE = _re.compile(r"([^|]+)\|[^|]*\|[^|]*\|(.*)")

def xt_lusu_tgs(content: str, **kwargs) -> Dict[str, Any]:
    """解析 XT 系列 LUSU .tgs 文件

    Parameters
    ----------
    content : str
        文件完整文本 (一次性读入内存即可，单文件 <100 KB)。

    Returns
    -------
    dict
        符合 LusuDataProcessor _store_lusu_data 字段规范的记录。
    """
    data: Dict[str, str] = {}
    for line in content.splitlines():
        m = _TAG_RE.match(line)
        if m:
            tag, val = m.groups()
            data[tag] = val.strip()

    # 必要字段缺失直接返回空 -> 上层可忽略
    try:
        ts_epoch = int(data['LUSU_CREATE_TIME_TAG'])
    except (KeyError, ValueError):
        return {}

    record = {
        'record_timestamp': _dt.datetime.fromtimestamp(ts_epoch),
        'illumination_mode': data.get('LUSU_PUPIL_SHAPE_MODE_TAG'),
        'na_value': _safe_float(data.get('LUSU_PUPIL_SHAPE_NA_TAG')),
        'sigma_inner': _safe_float(data.get('LUSU_PUPIL_SHAPE_SIGMA_INNER_TAG')),
        'sigma_outer': _safe_float(data.get('LUSU_PUPIL_SHAPE_SIGMA_OUTER_TAG')),
        'uniformity': _safe_float(data.get('LUSU_MAIN_RESULTS_SLIT_UNIFORMITY_TAG')),
        'intensity': _safe_float(data.get('LUSU_FIELD_STATISTICS_AVERAGE_SS_INTENSITY_TAG')),
        'raw_data': _json.dumps(data, ensure_ascii=False)
    }
    return record

def pas_log(content: str, **kwargs) -> Dict[str, Any]:
    """示例占位：解析 PAS 报表 .log 文件。  
    实际规则请根据样例自行补充正则或 Pandas 解析。"""
    # TODO: 实现必要解析后返回 record 字典
    return {}

# ------------------------- helpers -------------------------

def _safe_float(val: str | None) -> float | None:
    try:
        return float(val) if val not in (None, "") else None
    except ValueError:
        return None 