"""API endpoints cho 3 phần thông tin waypoint (MongoDB IRS)"""
from fastapi import APIRouter, HTTPException, status
from datetime import datetime
import uuid

from app.core.database import get_database
from app.schemas.waypoint_schemas import (
    WaypointDetailCreate, WaypointDetailUpdate, WaypointDetailResponse,
    VisitLogCreate, VisitLogUpdate, VisitLogResponse,
    TicketCreate, TicketUpdate, TicketResponse
)

router = APIRouter(prefix="/waypoints", tags=["Waypoint Info"])


# ==================== PHẦN 1: Thông tin chi tiết ====================
@router.get("/{waypoint_id}/detail", response_model=WaypointDetailResponse | None)
async def get_waypoint_detail(waypoint_id: str):
    db = get_database()
    detail = await db.waypoint_details.find_one({"waypoint_id": waypoint_id})
    return detail


@router.post("/{waypoint_id}/detail", response_model=WaypointDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_waypoint_detail(waypoint_id: str, detail_data: WaypointDetailCreate):
    db = get_database()
    waypoint = await db.waypoints.find_one({"id": waypoint_id})
    if not waypoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waypoint not found")
    
    existing = await db.waypoint_details.find_one({"waypoint_id": waypoint_id})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Waypoint detail already exists. Use PATCH to update.")
    
    now = datetime.utcnow()
    detail_doc = {
        "id": str(uuid.uuid4()),
        "waypoint_id": waypoint_id,
        **detail_data.model_dump(),
        "created_at": now,
        "updated_at": now
    }
    await db.waypoint_details.insert_one(detail_doc)
    return detail_doc


@router.patch("/{waypoint_id}/detail", response_model=WaypointDetailResponse)
async def update_waypoint_detail(waypoint_id: str, detail_data: WaypointDetailUpdate):
    db = get_database()
    detail = await db.waypoint_details.find_one({"waypoint_id": waypoint_id})
    if not detail:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waypoint detail not found")
    
    update_dict = detail_data.model_dump(exclude_unset=True)
    update_dict["updated_at"] = datetime.utcnow()
    await db.waypoint_details.update_one({"waypoint_id": waypoint_id}, {"$set": update_dict})
    return await db.waypoint_details.find_one({"waypoint_id": waypoint_id})


# ==================== PHẦN 2: Lịch sử ghé thăm ====================
@router.get("/{waypoint_id}/visit-logs", response_model=list[VisitLogResponse])
async def get_visit_logs(waypoint_id: str):
    db = get_database()
    cursor = db.waypoint_visit_logs.find({"waypoint_id": waypoint_id}).sort("visit_date", -1)
    logs = await cursor.to_list(length=1000)

    for log in logs:
        img_cursor = db.waypoint_images.find({"visit_log_id": log["id"]}).sort("created_at", 1)
        log["images"] = await img_cursor.to_list(length=100)

    return logs


@router.post("/{waypoint_id}/visit-logs", response_model=VisitLogResponse, status_code=status.HTTP_201_CREATED)
async def create_visit_log(waypoint_id: str, log_data: VisitLogCreate):
    db = get_database()
    waypoint = await db.waypoints.find_one({"id": waypoint_id})
    if not waypoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waypoint not found")
    
    now = datetime.utcnow()
    log_doc = {
        "id": str(uuid.uuid4()),
        "waypoint_id": waypoint_id,
        "visit_content": log_data.visit_content,
        "image_urls": log_data.image_urls,
        "visit_date": now,
        "created_at": now,
        "images": []
    }
    await db.waypoint_visit_logs.insert_one(log_doc)
    return log_doc


@router.patch("/visit-logs/{log_id}", response_model=VisitLogResponse)
async def update_visit_log(log_id: str, log_data: VisitLogUpdate):
    db = get_database()
    log = await db.waypoint_visit_logs.find_one({"id": log_id})
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit log not found")
    
    update_dict = log_data.model_dump(exclude_unset=True)
    await db.waypoint_visit_logs.update_one({"id": log_id}, {"$set": update_dict})
    
    updated_log = await db.waypoint_visit_logs.find_one({"id": log_id})
    img_cursor = db.waypoint_images.find({"visit_log_id": log_id}).sort("created_at", 1)
    updated_log["images"] = await img_cursor.to_list(length=100)
    return updated_log


@router.delete("/visit-logs/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_visit_log(log_id: str):
    db = get_database()
    log = await db.waypoint_visit_logs.find_one({"id": log_id})
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Visit log not found")
    
    await db.waypoint_images.delete_many({"visit_log_id": log_id})
    await db.waypoint_visit_logs.delete_one({"id": log_id})


# ==================== PHẦN 3: Phiếu thu ====================
@router.get("/{waypoint_id}/tickets", response_model=list[TicketResponse])
async def get_tickets(waypoint_id: str):
    db = get_database()
    cursor = db.waypoint_tickets.find({"waypoint_id": waypoint_id}).sort("collection_date", -1)
    return await cursor.to_list(length=1000)


@router.post("/{waypoint_id}/tickets", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(waypoint_id: str, ticket_data: TicketCreate):
    db = get_database()
    waypoint = await db.waypoints.find_one({"id": waypoint_id})
    if not waypoint:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Waypoint not found")
    
    now = datetime.utcnow()
    ticket_doc = {
        "id": str(uuid.uuid4()),
        "waypoint_id": waypoint_id,
        "visit_number": ticket_data.visit_number,
        "tickets_collected": ticket_data.tickets_collected,
        "notes": ticket_data.notes,
        "collection_date": now,
        "created_at": now
    }
    await db.waypoint_tickets.insert_one(ticket_doc)
    return ticket_doc


@router.patch("/tickets/{ticket_id}", response_model=TicketResponse)
async def update_ticket(ticket_id: str, ticket_data: TicketUpdate):
    db = get_database()
    ticket = await db.waypoint_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    
    update_dict = ticket_data.model_dump(exclude_unset=True)
    await db.waypoint_tickets.update_one({"id": ticket_id}, {"$set": update_dict})
    return await db.waypoint_tickets.find_one({"id": ticket_id})


@router.delete("/tickets/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ticket(ticket_id: str):
    db = get_database()
    ticket = await db.waypoint_tickets.find_one({"id": ticket_id})
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found")
    await db.waypoint_tickets.delete_one({"id": ticket_id})
