"""
应用配置 — 从 .env 加载环境变量
"""
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def _require(key: str) -> str:
    val = os.getenv(key)
    if not val:
        raise RuntimeError(f"缺少必需的环境变量: {key}，请在项目根目录 .env 文件中配置")
    return val


SUPABASE_URL = _require("SUPABASE_URL")
SUPABASE_SERVICE_KEY = _require("SUPABASE_SERVICE_KEY")

PORT = int(os.getenv("PORT", "3000"))
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")
