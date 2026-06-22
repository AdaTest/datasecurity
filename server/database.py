"""
数据库客户端 — Supabase Python SDK (service_role)
"""
from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_supabase: Client | None = None


def get_client() -> Client:
    """获取 Supabase 客户端（懒初始化，使用 service_role key）"""
    global _supabase
    if _supabase is None:
        _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _supabase
