from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from datetime import datetime, timezone
import logging
from models.user import KYCSubmission, User, KYCDocument
from database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/kyc", tags=["KYC"])

@router.post("/submit")
async def submit_kyc(submission: KYCSubmission, wallet_address: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Submit KYC documentation"""
    try:
        # Check if user exists
        user_doc = await db.users.find_one(
            {"wallet_address": wallet_address.lower()},
            {"_id": 0}
        )
        
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Create KYC document
        kyc_doc = KYCDocument(
            document_type=submission.document_type,
            document_number=submission.document_number,
            document_url=submission.document_url,
            verified=False
        )
        
        # Update user
        await db.users.update_one(
            {"wallet_address": wallet_address.lower()},
            {"$set": {
                "full_name": submission.full_name,
                "email": submission.email,
                "kyc_status": "pending",
                "kyc_documents": [kyc_doc.model_dump()],
                "kyc_submitted_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        return {
            "success": True,
            "message": "KYC submitted successfully. We'll review it within 48 hours."
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Submit KYC error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{wallet_address}")
async def get_kyc_status(wallet_address: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get KYC status for a user"""
    try:
        user_doc = await db.users.find_one(
            {"wallet_address": wallet_address.lower()},
            {"_id": 0, "kyc_status": 1, "kyc_submitted_at": 1, "kyc_approved_at": 1}
        )
        
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {
            "wallet_address": wallet_address,
            "kyc_status": user_doc.get("kyc_status", "not_submitted"),
            "submitted_at": user_doc.get("kyc_submitted_at"),
            "approved_at": user_doc.get("kyc_approved_at")
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get KYC status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))