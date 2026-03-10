from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import sys
import logging
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

sys.path.insert(0, str(ROOT_DIR))

from database import db, _client, ping_db  # noqa: E402

app = FastAPI(title="LawFlow API", version="1.0.0")

# ── CORS ───────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── LawFlow routes ─────────────────────────────────────────────────────────
from routes.auth import router as auth_router        # noqa: E402
from routes.cases import router as cases_router      # noqa: E402
from routes.clients import router as clients_router  # noqa: E402
from routes.hearings import router as hearings_router  # noqa: E402
from routes.ecourts import router as ecourts_router  # noqa: E402
from routes.notifications import router as notifications_router  # noqa: E402
from routes.firms import router as firms_router  # noqa: E402
from routes.client_portal import router as client_portal_router  # noqa: E402
from routes.case_files import router as case_files_router  # noqa: E402
from routes.payments import router as payments_router  # noqa: E402
from routes.referral import router as referral_router  # noqa: E402
from scheduler import start_scheduler, stop_scheduler  # noqa: E402

app.include_router(auth_router, prefix="/api")
app.include_router(cases_router, prefix="/api")
app.include_router(clients_router, prefix="/api")
app.include_router(hearings_router, prefix="/api")
app.include_router(ecourts_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(firms_router, prefix="/api")
app.include_router(client_portal_router, prefix="/api")
app.include_router(case_files_router)
app.include_router(payments_router, prefix="/api")
app.include_router(referral_router, prefix="/api")

# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# ── DB connectivity state ──────────────────────────────────────────────────
_db_connected: bool = False


# ── Startup ────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def on_startup():
    global _db_connected
    _db_connected = await ping_db()
    start_scheduler(db)  # Start daily digest scheduler


# ── Health check ───────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "database": "connected" if _db_connected else "disconnected",
    }


# ── Lifecycle ──────────────────────────────────────────────────────────────
@app.on_event("shutdown")
async def shutdown_db_client():
    stop_scheduler()
    _client.close()

# ── Static assets (intro video) ────────────────────────────────────────────
STATIC_DIR = ROOT_DIR / "static"
if STATIC_DIR.exists():
    app.mount("/api/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
