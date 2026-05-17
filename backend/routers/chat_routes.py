"""
Chat routes — Role Coach conversational endpoints.

A chat session is a thread of messages between a single user and the AI coach.
All endpoints require authentication.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..database import get_chat_sessions_collection, get_database
from ..services.ai_service import role_coach_reply
from .auth_routes import get_current_user

router = APIRouter(prefix="/chat", tags=["AI Chat"])
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────
# Request / response models
# ─────────────────────────────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    session_id: Optional[str] = Field(
        default=None,
        description="Existing session id. If omitted, a new session is created.",
    )
    message: str = Field(min_length=1, max_length=4000)


class SessionSummary(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int


class Message(BaseModel):
    role: str
    content: str
    created_at: datetime


# ─────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────

def _ensure_db():
    if get_database() is None or get_chat_sessions_collection() is None:
        raise HTTPException(status_code=503, detail="Database not configured")


def _serialize_session(doc: Dict[str, Any], with_messages: bool = False) -> Dict[str, Any]:
    out: Dict[str, Any] = {
        "id": str(doc.get("_id")),
        "title": doc.get("title", "New chat"),
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at", doc.get("created_at")),
        "message_count": len(doc.get("messages", [])),
    }
    if with_messages:
        out["messages"] = [
            {
                "role": m.get("role"),
                "content": m.get("content"),
                "created_at": m.get("created_at"),
            }
            for m in doc.get("messages", [])
        ]
    return out


def _derive_title(first_user_message: str) -> str:
    text = (first_user_message or "").strip().replace("\n", " ")
    if not text:
        return "New chat"
    return text[:60] + ("…" if len(text) > 60 else "")


# ─────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────

@router.get("/sessions")
async def list_sessions(current_user=Depends(get_current_user)) -> Dict[str, Any]:
    """List the current user's chat sessions (most recent first, no messages)."""
    _ensure_db()
    user_id = str(current_user["_id"])
    cursor = (
        get_chat_sessions_collection()
        .find({"user_id": user_id}, {"messages": 0})
        .sort("updated_at", -1)
        .limit(100)
    )
    sessions = [
        {
            "id": str(doc["_id"]),
            "title": doc.get("title", "New chat"),
            "created_at": doc.get("created_at"),
            "updated_at": doc.get("updated_at", doc.get("created_at")),
            "message_count": int(doc.get("message_count", 0)),
        }
        async for doc in cursor
    ]
    return {"sessions": sessions}


@router.get("/sessions/{session_id}")
async def get_session(session_id: str, current_user=Depends(get_current_user)) -> Dict[str, Any]:
    """Fetch a single session with its full message history."""
    _ensure_db()
    try:
        oid = ObjectId(session_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid session id")

    user_id = str(current_user["_id"])
    doc = await get_chat_sessions_collection().find_one({"_id": oid, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return _serialize_session(doc, with_messages=True)


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user=Depends(get_current_user)) -> Dict[str, Any]:
    """Delete a chat session."""
    _ensure_db()
    try:
        oid = ObjectId(session_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid session id")

    user_id = str(current_user["_id"])
    result = await get_chat_sessions_collection().delete_one(
        {"_id": oid, "user_id": user_id}
    )
    return {"deleted": result.deleted_count}


@router.post("/send")
async def send_message(
    payload: SendMessageRequest,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Send a user message. If `session_id` is omitted a new session is created.
    Returns the updated session with the new assistant reply appended.
    """
    _ensure_db()
    user_id = str(current_user["_id"])
    now = datetime.utcnow()
    coll = get_chat_sessions_collection()

    user_msg = {
        "role": "user",
        "content": payload.message.strip(),
        "created_at": now,
    }

    # Load or create session
    existing_doc: Optional[Dict[str, Any]] = None
    if payload.session_id:
        try:
            oid = ObjectId(payload.session_id)
        except (InvalidId, TypeError):
            raise HTTPException(status_code=400, detail="Invalid session id")
        existing_doc = await coll.find_one({"_id": oid, "user_id": user_id})
        if not existing_doc:
            raise HTTPException(status_code=404, detail="Session not found")

    prior_messages: List[Dict[str, Any]] = (
        existing_doc.get("messages", []) if existing_doc else []
    )

    # Build the conversation history for the LLM
    history_for_llm = [
        {"role": m["role"], "content": m["content"]}
        for m in prior_messages
        if m.get("role") in ("user", "assistant")
    ]
    history_for_llm.append({"role": "user", "content": user_msg["content"]})

    # Generate assistant reply (errors fall back to a canned plan)
    try:
        reply_text = role_coach_reply(history_for_llm)
    except Exception:
        logger.exception("Role coach reply failed")
        raise HTTPException(status_code=500, detail="AI reply failed")

    assistant_msg = {
        "role": "assistant",
        "content": reply_text,
        "created_at": datetime.utcnow(),
    }

    if existing_doc:
        updated_messages = prior_messages + [user_msg, assistant_msg]
        await coll.update_one(
            {"_id": existing_doc["_id"]},
            {
                "$set": {
                    "messages": updated_messages,
                    "updated_at": assistant_msg["created_at"],
                    "message_count": len(updated_messages),
                }
            },
        )
        doc = await coll.find_one({"_id": existing_doc["_id"]})
    else:
        new_doc = {
            "user_id": user_id,
            "title": _derive_title(user_msg["content"]),
            "created_at": now,
            "updated_at": assistant_msg["created_at"],
            "messages": [user_msg, assistant_msg],
            "message_count": 2,
        }
        result = await coll.insert_one(new_doc)
        doc = await coll.find_one({"_id": result.inserted_id})

    return _serialize_session(doc, with_messages=True)


class RegenerateRequest(BaseModel):
    session_id: str = Field(min_length=1, description="Existing session id")


@router.post("/regenerate")
async def regenerate_last_reply(
    payload: RegenerateRequest,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Discard the trailing assistant message in this session and produce a new
    reply for the same preceding user prompt. Returns the updated session.
    """
    _ensure_db()
    user_id = str(current_user["_id"])
    coll = get_chat_sessions_collection()

    try:
        oid = ObjectId(payload.session_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid session id")

    doc = await coll.find_one({"_id": oid, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")

    messages: List[Dict[str, Any]] = list(doc.get("messages") or [])
    # Strip a trailing assistant turn if present
    if messages and messages[-1].get("role") == "assistant":
        messages = messages[:-1]
    if not messages or messages[-1].get("role") != "user":
        raise HTTPException(
            status_code=400,
            detail="Nothing to regenerate — the last message is not a user prompt.",
        )

    # Build LLM history from the trimmed messages
    history_for_llm = [
        {"role": m["role"], "content": m["content"]}
        for m in messages
        if m.get("role") in ("user", "assistant")
    ]

    try:
        reply_text = role_coach_reply(history_for_llm)
    except Exception:
        logger.exception("Role coach regenerate failed")
        raise HTTPException(status_code=500, detail="AI reply failed")

    assistant_msg = {
        "role": "assistant",
        "content": reply_text,
        "created_at": datetime.utcnow(),
    }
    updated_messages = messages + [assistant_msg]
    await coll.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "messages": updated_messages,
                "updated_at": assistant_msg["created_at"],
                "message_count": len(updated_messages),
            }
        },
    )
    doc = await coll.find_one({"_id": doc["_id"]})
    return _serialize_session(doc, with_messages=True)
