from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
import logging

class Database:
    client: AsyncIOMotorClient = None
    db = None

db_instance = Database()

async def connect_to_mongo():
    try:
        db_instance.client = AsyncIOMotorClient(settings.MONGODB_URL)
        db_instance.db = db_instance.client[settings.DATABASE_NAME]
        logging.info(f"Connected to MongoDB at {settings.MONGODB_URL}")
    except Exception as e:
        logging.warning(f"Could not connect to MongoDB: {e}")

async def close_mongo_connection():
    if db_instance.client:
        db_instance.client.close()
        logging.info("MongoDB connection closed")

def get_database():
    return db_instance.db
