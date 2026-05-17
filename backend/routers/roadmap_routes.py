"""
Saved roadmap routes — persist generated role guides per user and stream
them back as JSON or as a polished PDF.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from ..database import get_database, get_saved_roadmaps_collection
from ..services.report_generator import generate_roadmap_pdf
from .auth_routes import get_current_user

router = APIRouter(prefix="/roadmaps", tags=["Saved Roadmaps"])
logger = logging.getLogger(__name__)


# ─── Request models ────────────────────────────────────────────────────

class RoadmapStep(BaseModel):
    step: int = 1
    title: str = ""
    duration: str = ""
    description: str = ""
    resources: List[str] = Field(default_factory=list)


class SaveRoadmapRequest(BaseModel):
    role: str = Field(min_length=1, max_length=120)
    summary: str = ""
    key_skills: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    requirements: List[str] = Field(default_factory=list)
    learning_path: List[RoadmapStep] = Field(default_factory=list)
    estimated_time: str = ""
    career_growth: List[str] = Field(default_factory=list)
    source: str = "ai"


# ─── Helpers ───────────────────────────────────────────────────────────

def _ensure_db():
    if get_database() is None or get_saved_roadmaps_collection() is None:
        raise HTTPException(status_code=503, detail="Database not configured")


def _serialize(doc: Dict[str, Any], with_payload: bool = False) -> Dict[str, Any]:
    out = {
        "id": str(doc["_id"]),
        "role": doc.get("role", ""),
        "summary": (doc.get("summary") or "")[:240],
        "estimated_time": doc.get("estimated_time", ""),
        "created_at": doc.get("created_at"),
    }
    if with_payload:
        out.update({
            "key_skills": doc.get("key_skills", []),
            "tools": doc.get("tools", []),
            "requirements": doc.get("requirements", []),
            "learning_path": doc.get("learning_path", []),
            "career_growth": doc.get("career_growth", []),
            "source": doc.get("source", "ai"),
            "summary": doc.get("summary", ""),
        })
    return out


def _doc_to_guide(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a saved Mongo doc back to the shape generate_role_guide returns."""
    return {
        "role": doc.get("role", ""),
        "summary": doc.get("summary", ""),
        "key_skills": doc.get("key_skills", []),
        "tools": doc.get("tools", []),
        "requirements": doc.get("requirements", []),
        "learning_path": doc.get("learning_path", []),
        "estimated_time": doc.get("estimated_time", ""),
        "career_growth": doc.get("career_growth", []),
    }


# ─── Endpoints ─────────────────────────────────────────────────────────

@router.post("")
async def save_roadmap(
    payload: SaveRoadmapRequest,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Persist a generated roadmap for the current user."""
    _ensure_db()
    coll = get_saved_roadmaps_collection()
    user_id = str(current_user["_id"])

    doc = {
        "user_id": user_id,
        "role": payload.role.strip(),
        "summary": payload.summary,
        "key_skills": payload.key_skills,
        "tools": payload.tools,
        "requirements": payload.requirements,
        "learning_path": [s.dict() for s in payload.learning_path],
        "estimated_time": payload.estimated_time,
        "career_growth": payload.career_growth,
        "source": payload.source,
        "created_at": datetime.utcnow(),
    }
    result = await coll.insert_one(doc)
    saved = await coll.find_one({"_id": result.inserted_id})
    return {"saved": True, "roadmap": _serialize(saved, with_payload=True)}


@router.get("")
async def list_roadmaps(current_user=Depends(get_current_user)) -> Dict[str, Any]:
    """List all saved roadmaps for the current user (most recent first)."""
    _ensure_db()
    coll = get_saved_roadmaps_collection()
    user_id = str(current_user["_id"])

    cursor = (
        coll.find({"user_id": user_id})
        .sort("created_at", -1)
        .limit(100)
    )
    items = [_serialize(doc) async for doc in cursor]
    return {"roadmaps": items}


@router.get("/{roadmap_id}")
async def get_roadmap(
    roadmap_id: str,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """Return the full saved roadmap payload."""
    _ensure_db()
    try:
        oid = ObjectId(roadmap_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid id")

    user_id = str(current_user["_id"])
    doc = await get_saved_roadmaps_collection().find_one(
        {"_id": oid, "user_id": user_id}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return {"roadmap": _serialize(doc, with_payload=True)}


@router.delete("/{roadmap_id}")
async def delete_roadmap(
    roadmap_id: str,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    _ensure_db()
    try:
        oid = ObjectId(roadmap_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid id")

    user_id = str(current_user["_id"])
    result = await get_saved_roadmaps_collection().delete_one(
        {"_id": oid, "user_id": user_id}
    )
    return {"deleted": result.deleted_count}


@router.get("/{roadmap_id}/pdf")
async def download_roadmap_pdf(
    roadmap_id: str,
    current_user=Depends(get_current_user),
):
    """Build (or rebuild) a PDF for a saved roadmap and stream it back."""
    _ensure_db()
    try:
        oid = ObjectId(roadmap_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=400, detail="Invalid id")

    user_id = str(current_user["_id"])
    doc = await get_saved_roadmaps_collection().find_one(
        {"_id": oid, "user_id": user_id}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")

    try:
        filepath = generate_roadmap_pdf(_doc_to_guide(doc))
    except Exception:
        logger.exception("Roadmap PDF generation failed")
        raise HTTPException(status_code=500, detail="Could not build PDF")

    if not os.path.exists(filepath):
        raise HTTPException(status_code=500, detail="PDF was not written")

    role_slug = "".join(
        ch if ch.isalnum() else "_"
        for ch in (doc.get("role") or "roadmap")
    ).strip("_") or "roadmap"
    download_name = f"{role_slug}_roadmap.pdf"

    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=download_name,
    )
