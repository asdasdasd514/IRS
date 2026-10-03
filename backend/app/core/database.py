import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db_instance = MongoDB()

async def ensure_database_indexes(db):
    """Tự động đảm bảo tất cả các indexes hiệu năng cao được tạo cho hệ thống"""
    if db is None:
        return
    try:
        # 1. system_logs indexes (Tối ưu tìm kiếm và lọc nhật ký hệ thống)
        await db.system_logs.create_index([("timestamp", -1)])
        await db.system_logs.create_index([("action", 1)])
        await db.system_logs.create_index([("entity_type", 1)])
        await db.system_logs.create_index([("campaign_id", 1)])
        await db.system_logs.create_index([("trip_id", 1)])
        await db.system_logs.create_index([("actor_user.id", 1)])

        # 2. campaign_waypoints compound indexes (Tối ưu truy vấn lộ trình và check-in)
        await db.campaign_waypoints.create_index([
            ("trip_id", 1),
            ("is_deleted", 1),
            ("is_visited", 1),
            ("visit_order", 1)
        ])
        await db.campaign_waypoints.create_index([("campaign_id", 1), ("is_deleted", 1)])

        # 3. admission_trips indexes
        await db.admission_trips.create_index([("campaign_id", 1), ("is_deleted", 1)])
        await db.admission_trips.create_index([("status", 1), ("is_deleted", 1)])

        # 4. schools indexes
        await db.schools.create_index([("id", 1), ("is_deleted", 1)])
        await db.schools.create_index([("code", 1), ("is_deleted", 1)])

        # 5. cached_places index (Persistent Cache cho SerpAPI)
        await db.cached_places.create_index([("cache_key", 1)], unique=True)
        await db.cached_places.create_index([("expires_at", 1)], expireAfterSeconds=0)

        logging.info("⚡ [MongoDB]: Đã tối ưu hóa tất cả Indexes cho hệ thống.")
    except Exception as e:
        logging.warning(f"⚠️ [MongoDB]: Lỗi khi tạo indexes hiệu năng: {e}")

async def connect_to_mongo():
    try:
        db_instance.client = AsyncIOMotorClient(settings.MONGODB_URL)
        db_instance.db = db_instance.client[settings.DATABASE_NAME]
        logging.info(f"✅ [MongoDB]: Connected to database '{settings.DATABASE_NAME}' at {settings.MONGODB_URL}")
        await ensure_database_indexes(db_instance.db)
    except Exception as e:
        logging.warning(f"⚠️ [MongoDB]: Could not connect to MongoDB: {e}")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        logging.info("🔌 [MongoDB]: Connection closed")

def get_database():
    return db_instance.db
