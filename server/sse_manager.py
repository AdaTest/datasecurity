"""
SSE 管理器 — 管理客户端连接、心跳保活、广播事件
"""
import asyncio
import json


class SSEManager:

    def __init__(self):
        self._clients: list[asyncio.Queue] = []

    def add_client(self) -> asyncio.Queue:
        queue: asyncio.Queue = asyncio.Queue(maxsize=256)
        self._clients.append(queue)
        return queue

    def remove_client(self, queue: asyncio.Queue):
        try:
            self._clients.remove(queue)
        except ValueError:
            pass

    def broadcast_sync(self, event: str, data: dict):
        """同步广播（从同步业务逻辑中调用）"""
        payload = {"event": event, "data": json.dumps(data, ensure_ascii=False)}
        dead = []
        for q in self._clients:
            try:
                q.put_nowait(payload)
            except asyncio.QueueFull:
                dead.append(q)
        for q in dead:
            self.remove_client(q)

    async def broadcast(self, event: str, data: dict):
        """异步广播"""
        self.broadcast_sync(event, data)

    async def event_generator(self, queue: asyncio.Queue):
        try:
            yield {"event": "connected", "data": "ok"}
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30)
                    yield msg
                except asyncio.TimeoutError:
                    yield {"event": "heartbeat", "data": ""}
        except asyncio.CancelledError:
            pass
        finally:
            self.remove_client(queue)


sse_manager = SSEManager()
