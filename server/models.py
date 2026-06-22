"""
Pydantic 数据模型 — 请求 / 响应校验
"""
from pydantic import BaseModel, Field
from typing import Any


# ═══════════════ 请求模型 ═══════════════

class JourneyCreate(BaseModel):
    """创建旅程"""
    id: str = Field(..., description="旅程唯一标识")
    title: str = Field(..., description="旅程标题")
    data: dict[str, Any] = Field(..., description="旅程完整数据 JSON")


class JourneyUpdate(BaseModel):
    """更新旅程（需要版本号做乐观锁）"""
    title: str | None = Field(None, description="旅程标题（可选）")
    data: dict[str, Any] | None = Field(None, description="旅程完整数据 JSON（可选）")
    version: int = Field(..., description="当前已知版本号，用于乐观锁冲突检测")


# ═══════════════ 响应模型 ═══════════════

class JourneySummary(BaseModel):
    """旅程摘要（列表用，不含完整 data）"""
    id: str
    title: str
    phases: int
    stages: int
    version: int
    updated_at: str


class JourneyDetail(BaseModel):
    """旅程详情（含完整 data）"""
    id: str
    title: str
    data: dict[str, Any]
    version: int
    updated_at: str
    created_at: str | None = None
