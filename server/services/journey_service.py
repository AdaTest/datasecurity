"""
旅程业务逻辑 — CRUD + 乐观锁冲突检测 + SSE 广播
使用 Supabase Python SDK（同步客户端，FastAPI 在线程池中运行）
"""
import json
from datetime import datetime, timezone

from database import get_client
from sse_manager import sse_manager


# ═══════════════ 初始化 ═══════════════

def ensure_version_column():
    """确保 journeys 表有 version 列（通过尝试查询来检测）"""
    client = get_client()
    try:
        client.table("journeys").select("version").limit(1).execute()
    except Exception:
        # version 列不存在，需要手动用 SQL 添加
        pass  # 用户需在 Supabase SQL Editor 中执行迁移


# ═══════════════ 辅助 ═══════════════

def _count_from_data(data: dict, key: str) -> int:
    arr = data.get(key, [])
    return len(arr) if isinstance(arr, list) else 0


def _row_to_summary(row: dict) -> dict:
    data = row.get("data", {})
    return {
        "id": row["id"],
        "title": row.get("title", ""),
        "phases": _count_from_data(data, "phases"),
        "stages": _count_from_data(data, "stages"),
        "version": row.get("version", 1),
        "updated_at": row.get("updated_at", ""),
    }


def _row_to_detail(row: dict) -> dict:
    return {
        "id": row["id"],
        "title": row.get("title", ""),
        "data": row.get("data", {}),
        "version": row.get("version", 1),
        "updated_at": row.get("updated_at", ""),
    }


# ═══════════════ CRUD ═══════════════

def list_all() -> list[dict]:
    """查询所有旅程摘要"""
    client = get_client()
    res = client.table("journeys").select("id,title,data,version,updated_at") \
                .order("updated_at", desc=True).execute()
    return [_row_to_summary(r) for r in (res.data or [])]


def get_by_id(journey_id: str) -> dict | None:
    """查询单个旅程详情"""
    client = get_client()
    res = client.table("journeys").select("*").eq("id", journey_id).maybe_single().execute()
    if not res.data:
        return None
    return _row_to_detail(res.data)


def create(journey_id: str, title: str, data: dict) -> dict | None:
    """创建新旅程。如果 id 已存在则返回 None。"""
    client = get_client()

    existing = client.table("journeys").select("id").eq("id", journey_id).execute()
    if existing.data and len(existing.data) > 0:
        return None

    now = datetime.now(timezone.utc).isoformat()
    row = {
        "id": journey_id,
        "title": title,
        "data": data,
        "version": 1,
        "updated_at": now,
    }
    res = client.table("journeys").insert(row).execute()
    if not res.data:
        return None

    result = _row_to_detail(res.data[0])
    sse_manager.broadcast_sync("journey-created", {"id": journey_id, "title": title})
    return result


def update(journey_id: str, title: str | None, data: dict | None, version: int) -> dict | None:
    """乐观锁更新。返回结果或冲突信息。"""
    client = get_client()

    current = client.table("journeys").select("*").eq("id", journey_id).maybe_single().execute()
    if not current.data:
        return None

    record = current.data
    if record.get("version", 1) != version:
        return {
            "__conflict__": True,
            "current_version": record.get("version", 1),
            "current_data": record.get("data", {}),
            "your_version": version,
        }

    now = datetime.now(timezone.utc).isoformat()
    update_data = {
        "version": version + 1,
        "updated_at": now,
    }
    if title is not None:
        update_data["title"] = title
    if data is not None:
        update_data["data"] = data

    res = client.table("journeys").update(update_data) \
                .eq("id", journey_id).eq("version", version).execute()

    if not res.data:
        current2 = client.table("journeys").select("*").eq("id", journey_id).maybe_single().execute()
        if current2.data:
            r2 = current2.data
            return {
                "__conflict__": True,
                "current_version": r2.get("version", 1),
                "current_data": r2.get("data", {}),
                "your_version": version,
            }
        return None

    result = _row_to_detail(res.data[0])
    sse_manager.broadcast_sync("journey-updated", {
        "id": journey_id,
        "version": result["version"],
        "updated_at": result["updated_at"],
    })
    return result


def delete(journey_id: str) -> bool:
    client = get_client()
    client.table("journeys").delete().eq("id", journey_id).execute()
    sse_manager.broadcast_sync("journey-deleted", {"id": journey_id})
    return True
