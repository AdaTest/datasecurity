"""
FastAPI 应用入口
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
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

# 路由
app.include_router(journeys_router)


# SSE 端点
@app.get("/api/events")
async def sse_endpoint(request: Request):
    """Server-Sent Events 实时事件流"""
    queue = sse_manager.add_client()

    async def event_gen():
        async for msg in sse_manager.event_generator(queue):
            yield msg

    return EventSourceResponse(event_gen())


# 健康检查
@app.get("/api/health")
async def health():
    return {"ok": True, "service": "journey-platform-api"}


# ═══════════════ 启动入口 ═══════════════
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)
