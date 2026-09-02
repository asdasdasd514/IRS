import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

class MongoDB:
    client: AsyncIOMotorClient = None
    db = None

db_instance = MongoDB()

async def connect_to_mongo():
    try:
        db_instance.client = AsyncIOMotorClient(settings.MONGODB_URL)
        db_instance.db = db_instance.client[settings.DATABASE_NAME]
        logging.info(f"✅ [MongoDB]: Connected to database '{settings.DATABASE_NAME}' at {settings.MONGODB_URL}")
    except Exception as e:
        logging.warning(f"⚠️ [MongoDB]: Could not connect to MongoDB: {e}")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        logging.info("🔌 [MongoDB]: Connection closed")

def get_database():
    return db_instance.db
