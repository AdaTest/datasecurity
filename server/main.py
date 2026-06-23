"""
FastAPI 应用入口 — 前后端合一

架构：
  /api/*  → FastAPI 路由（CRUD + SSE）
  /*      → 前端静态文件（HTML/JS/CSS）
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sse_starlette.sse import EventSourceResponse

from config import CORS_ORIGINS, PORT
from routers.journeys import router as journeys_router
from sse_manager import sse_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动/关闭生命周期"""
    print("[OK] API service started")
    yield
    print("[OK] API service stopped")


app = FastAPI(
    title="数据安全未来旅程协作平台 API",
    version="2.0.0",
    description="前后端分离架构 — 旅程 CRUD + 乐观锁并发控制 + SSE 实时推送",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════ API 路由（必须在 StaticFiles mount 之前注册）═══════════════
app.include_router(journeys_router)


@app.get("/api/events")
async def sse_endpoint(request: Request):
    """Server-Sent Events 实时事件流"""
    queue = sse_manager.add_client()

    async def event_gen():
        async for msg in sse_manager.event_generator(queue):
            yield msg

    return EventSourceResponse(event_gen())


@app.get("/api/health")
async def health():
    return {"ok": True, "service": "journey-platform-api"}


# ═══════════════ 前端静态文件（放最后，/api/* 之外的全部走这里）═══════════════
import os
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..")
app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="static")

# ═══════════════ 启动入口 ═══════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
