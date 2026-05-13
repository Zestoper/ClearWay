from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from typing import Optional, Dict, List
from datetime import datetime
from jose import JWTError

from app.db.database import get_db, SessionLocal
from app.models.chat import ChatRoom, ChatMessage
from app.models.user import User
from app.api.v1.deps import get_optional_user, get_admin_user
from app.core.security import decode_token

router = APIRouter()


# ── WebSocket connection manager ──────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, ws: WebSocket, room_id: int):
        await ws.accept()
        self.connections.setdefault(room_id, []).append(ws)

    def disconnect(self, ws: WebSocket, room_id: int):
        conns = self.connections.get(room_id, [])
        if ws in conns:
            conns.remove(ws)

    async def broadcast(self, room_id: int, msg: dict):
        for ws in list(self.connections.get(room_id, [])):
            try:
                await ws.send_json(msg)
            except Exception:
                pass


manager = ConnectionManager()


def _msg_to_dict(m: ChatMessage) -> dict:
    return {
        "id": m.id,
        "room_id": m.room_id,
        "sender": m.sender,
        "content": m.content,
        "msg_type": m.msg_type,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


def _room_to_dict(r: ChatRoom) -> dict:
    last = r.messages[-1] if r.messages else None
    return {
        "id": r.id,
        "user_id": r.user_id,
        "guest_name": r.guest_name,
        "guest_email": r.guest_email,
        "category": r.category,
        "status": r.status,
        "admin_unread": r.admin_unread,
        "user_unread": r.user_unread,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        "last_message": last.content[:60] if last else None,
        "last_message_type": last.msg_type if last else None,
        "user_name": r.user.name if r.user else r.guest_name,
    }


# ── REST endpoints ────────────────────────────────────────────────────────────

@router.post("/rooms")
def create_room(
    body: dict,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    room = ChatRoom(
        user_id=current_user.id if current_user else None,
        guest_name=body.get("guest_name", ""),
        guest_email=body.get("guest_email", ""),
        category=body.get("category", "기타"),
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return _room_to_dict(room)


@router.get("/rooms")
def admin_list_rooms(
    status: Optional[str] = "open",
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    q = db.query(ChatRoom)
    if status and status != "all":
        q = q.filter(ChatRoom.status == status)
    rooms = q.order_by(ChatRoom.updated_at.desc()).all()
    return [_room_to_dict(r) for r in rooms]


@router.get("/rooms/mine")
def my_rooms(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    if not current_user:
        return []
    rooms = (
        db.query(ChatRoom)
        .filter(ChatRoom.user_id == current_user.id)
        .order_by(ChatRoom.updated_at.desc())
        .all()
    )
    return [_room_to_dict(r) for r in rooms]


@router.get("/rooms/{room_id}/messages")
def get_messages(
    room_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room:
        return []
    if current_user and current_user.is_admin:
        room.admin_unread = 0
    else:
        room.user_unread = 0
    db.commit()
    return [_msg_to_dict(m) for m in room.messages]


@router.put("/rooms/{room_id}/close")
def close_room(
    room_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if room:
        room.status = "closed"
        db.commit()
    return {"ok": True}


# ── WebSocket ─────────────────────────────────────────────────────────────────

@router.websocket("/ws/{room_id}")
async def chat_ws(
    websocket: WebSocket,
    room_id: int,
    token: Optional[str] = Query(default=None),
):
    # Determine sender role from token
    sender = "user"
    if token:
        try:
            payload = decode_token(token)
            user_id = int(payload["sub"])
            db_check = SessionLocal()
            try:
                u = db_check.query(User).filter(User.id == user_id).first()
                if u and u.is_admin:
                    sender = "admin"
            finally:
                db_check.close()
        except (JWTError, Exception):
            pass

    await manager.connect(websocket, room_id)

    # Send history on connect
    db = SessionLocal()
    try:
        room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
        if room:
            history = [_msg_to_dict(m) for m in room.messages]
            await websocket.send_json({"type": "history", "messages": history})
            # Reset unread for connecting side
            if sender == "admin":
                room.admin_unread = 0
            else:
                room.user_unread = 0
            db.commit()
    finally:
        db.close()

    try:
        while True:
            data = await websocket.receive_json()
            content = data.get("content", "")
            msg_type = data.get("msg_type", "text")
            if not content:
                continue

            db = SessionLocal()
            try:
                room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
                if not room:
                    continue

                msg = ChatMessage(
                    room_id=room_id,
                    sender=sender,
                    content=content,
                    msg_type=msg_type,
                )
                db.add(msg)

                # Increment other side's unread
                if sender == "admin":
                    room.user_unread = (room.user_unread or 0) + 1
                else:
                    room.admin_unread = (room.admin_unread or 0) + 1
                room.updated_at = datetime.now()

                db.commit()
                db.refresh(msg)

                await manager.broadcast(room_id, {
                    "type": "message",
                    **_msg_to_dict(msg),
                })
            finally:
                db.close()

    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
    except Exception:
        manager.disconnect(websocket, room_id)
