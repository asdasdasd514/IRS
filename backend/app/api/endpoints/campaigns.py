from fastapi import APIRouter, HTTPException, status
from typing import List
from datetime import datetime
from app.models.schemas import CampaignCreate, CampaignOut
from app.db.mongodb import get_database

router = APIRouter()

# Mock campaigns initial data
MOCK_CAMPAIGNS = [
    {
        "id": "cmp_001",
        "title": "Chiến dịch Tuyển sinh Lưu động THPT Cần Thơ & An Giang 2026",
        "description": "Tư vấn hướng nghiệp và giới thiệu ngành học tới các điểm trường THPT khu vực ĐBSCL.",
        "region": "Đồng bằng Sông Cửu Long",
        "start_date": datetime.utcnow().isoformat(),
        "end_date": datetime.utcnow().isoformat(),
        "status": "active",
        "budget": 25000000.0,
        "targets": [
            {
                "school_name": "THPT Chuyên Lý Tự Trọng",
                "address": "Phường Hưng Thạnh, Quận Cái Răng, Cần Thơ",
                "location": {"lat": 10.0076, "lng": 105.7725, "address": "Cần Thơ"},
                "estimated_students": 450,
                "priority": 1
            },
            {
                "school_name": "THPT Bùi Hữu Nghĩa",
                "address": "Đường An Thới, Bình Thủy, Cần Thơ",
                "location": {"lat": 10.0612, "lng": 105.7611, "address": "Cần Thơ"},
                "estimated_students": 320,
                "priority": 2
            }
        ],
        "images": [
            {
                "url": "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800",
                "public_id": "irs/demo_1",
                "created_at": datetime.utcnow().isoformat()
            }
        ],
        "created_at": datetime.utcnow().isoformat()
    }
]

@router.get("/", response_model=List[CampaignOut])
async def get_campaigns():
    db = get_database()
    if db is not None:
        try:
            cursor = db.campaigns.find({})
            campaigns = await cursor.to_list(length=100)
            if campaigns:
                for c in campaigns:
                    c["id"] = str(c["_id"])
                return campaigns
        except Exception:
            pass
    return MOCK_CAMPAIGNS

@router.post("/", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def create_campaign(campaign_in: CampaignCreate):
    new_campaign = campaign_in.dict()
    new_campaign["id"] = f"cmp_{len(MOCK_CAMPAIGNS) + 1:03d}"
    new_campaign["images"] = []
    new_campaign["created_at"] = datetime.utcnow()
    
    db = get_database()
    if db is not None:
        try:
            res = await db.campaigns.insert_one(new_campaign)
            new_campaign["id"] = str(res.inserted_id)
        except Exception:
            pass
            
    MOCK_CAMPAIGNS.append(new_campaign)
    return new_campaign
