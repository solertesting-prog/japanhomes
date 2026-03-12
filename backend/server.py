from fastapi import FastAPI, APIRouter, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorDatabase
import os
import logging
from pathlib import Path
from database import get_database, close_database

# Import route modules
from routes import auth, properties, transactions, reservations, kyc, admin

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create the main app without a prefix
app = FastAPI(
    title="ZenCapital - Property Tokenization API",
    description="API for tokenizing real estate properties in Japan",
    version="1.0.0"
)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Include all route modules
api_router.include_router(auth.router)
api_router.include_router(properties.router)
api_router.include_router(transactions.router)
api_router.include_router(reservations.router)
api_router.include_router(kyc.router)
api_router.include_router(admin.router)

# Health check endpoint
@api_router.get("/health")
async def health_check(db: AsyncIOMotorDatabase = Depends(get_database)):
    try:
        await db.command("ping")
        return {
            "status": "healthy",
            "service": "ZenCapital Property Tokenization API",
            "database": "connected"
        }
    except Exception:
        return {
            "status": "unhealthy",
            "service": "ZenCapital Property Tokenization API",
            "database": "disconnected"
        }

# Root endpoint
@api_router.get("/")
async def root():
    return {
        "message": "Welcome to ZenCapital - Property Tokenization Platform",
        "version": "1.0.0",
        "docs": "/docs"
    }

# Include the router in the main app
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    close_database()