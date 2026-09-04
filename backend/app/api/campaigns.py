"""
Campaign API Endpoints - Quản lý Chiến dịch Tuyển sinh Lưu động
"""

from typing import List, Optional
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.database import get_database
from app.schemas import CampaignCreate, CampaignResponse
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])


@router.get("", response_model=List[CampaignResponse])
async def list_campaigns(current_user: dict = Depends(get_current_user)):
    db = get_database()
    cursor = db.campaigns.find({"is_deleted": {"$ne": True}}).sort("created_at", -1)
    campaigns = await cursor.to_list(length=100)
    return campaigns


@router.get("/{campaign_id}", response_model=CampaignResponse)
async def get_campaign(campaign_id: str, current_user: dict = Depends(get_current_user)):
    db = get_database()
    campaign = await db.campaigns.find_one({"id": campaign_id, "is_deleted": {"$ne": True}})
    if not campaign:
        raise HTTPException(status_code=404, detail="Chiến dịch tuyển sinh không tồn tại")
    return campaign


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(
    campaign_data: CampaignCreate,
    current_user: dict = Depends(get_current_user)
):
    db = get_database()
    now = datetime.now(timezone.utc)
    camp_id = str(uuid.uuid4())
    camp_doc = {
        "id": camp_id,
        **campaign_data.model_dump(),
        "manager_id": current_user.get("id"),
        "created_at": now,
        "updated_at": now
    }
    await db.campaigns.insert_one(camp_doc)
    return camp_doc


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(
    campaign_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Xóa mềm chiến dịch và các chuyến đi trực thuộc.
    """
    db = get_database()
    now = datetime.now(timezone.utc)
    camp = await db.campaigns.find_one({"id": campaign_id, "is_deleted": {"$ne": True}})
    if not camp:
        raise HTTPException(status_code=404, detail="Chiến dịch tuyển sinh không tồn tại")

    await db.campaigns.update_one(
        {"id": campaign_id},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
    )
    # Xóa mềm các chuyến đi thuộc chiến dịch
    await db.admission_trips.update_many(
        {"campaign_id": campaign_id, "is_deleted": {"$ne": True}},
        {"$set": {"is_deleted": True, "deleted_at": now, "updated_at": now}}
    )
