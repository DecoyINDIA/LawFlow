from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import logging
from pathlib import Path

load_dotenv(Path(__file__).parent / '.env')

logger = logging.getLogger(__name__)

# Priority: MONGODB_URL → MONGO_URL (Emergent local) → Atlas fallback
ATLAS_URL = (
    "mongodb+srv://xolverindia_db_user:vJP8mX9FoUeWmiU4"
    "@lawflow.63v67n4.mongodb.net/lawflow"
    "?retryWrites=true&w=majority&appName=LawFlow"
)

MONGO_URL = (
    os.environ.get("MONGODB_URL")
    or os.environ.get("MONGO_URL")
    or ATLAS_URL
)
DB_NAME = os.environ.get("DB_NAME", "lawflow")

_client = AsyncIOMotorClient(MONGO_URL)
db = _client[DB_NAME]


async def get_db():
    return db


async def ping_db() -> bool:
    """Ping MongoDB to verify connectivity. Returns True on success."""
    try:
        await _client.admin.command("ping")
        logger.info("✅ Connected to MongoDB Atlas")
        return True
    except Exception as exc:
        logger.error("❌ MongoDB connection failed: %s", exc)
        return False
