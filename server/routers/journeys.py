"""
旅程路由 — /api/journeys/*
"""
from fastapi import APIRouter, HTTPException

from models import JourneyCreate, JourneyUpdate
from services import journey_service

router = APIRouter(prefix="/api/journeys", tags=["journeys"])


@router.get("")
def list_journeys():
    return {"journeys": journey_service.list_all()}


@router.get("/{journey_id}")
def get_journey(journey_id: str):
    result = journey_service.get_by_id(journey_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Journey not found")
    return {"journey": result}


@router.post("", status_code=201)
def create_journey(body: JourneyCreate):
    result = journey_service.create(body.id, body.title, body.data)
    if result is None:
        raise HTTPException(status_code=409, detail="Journey already exists")
    return {"journey": result}


@router.put("/{journey_id}")
def update_journey(journey_id: str, body: JourneyUpdate):
    result = journey_service.update(journey_id, body.title, body.data, body.version)

    if result is None:
        raise HTTPException(status_code=404, detail="Journey not found")

    if result.get("__conflict__"):
        raise HTTPException(
            status_code=409,
            detail={
                "error": "Conflict: journey was modified by another user",
                "current_version": result["current_version"],
                "current_data": result["current_data"],
                "your_version": result["your_version"],
            },
        )

    return {"journey": result}


@router.delete("/{journey_id}")
def delete_journey(journey_id: str):
    journey_service.delete(journey_id)
    return {"deleted": True}
