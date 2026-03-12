from fastapi import APIRouter, HTTPException, Query, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import logging
from models.user import User
from models.property import Property
from models.transaction import Transaction
from database import get_database
from utils.auth import verify_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(verify_admin)])

@router.get("/users", response_model=List[User])
async def get_all_users(
    db: AsyncIOMotorDatabase = Depends(get_database),
    kyc_status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
):
    """Get all users (admin only)"""
    try:
        query = {}
        if kyc_status:
            query["kyc_status"] = kyc_status
        
        users = await db.users.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        return [User(**user) for user in users]
    except Exception as e:
        logger.error(f"Get all users error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/kyc-requests", response_model=List[User])
async def get_kyc_requests(
    db: AsyncIOMotorDatabase = Depends(get_database),
    status: str = "pending",
    limit: int = 50
):
    """Get KYC requests (admin only)"""
    try:
        users = await db.users.find(
            {"kyc_status": status},
            {"_id": 0}
        ).sort("kyc_submitted_at", -1).limit(limit).to_list(limit)
        
        return [User(**user) for user in users]
    except Exception as e:
        logger.error(f"Get KYC requests error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/kyc/{wallet_address}/approve")
async def approve_kyc(wallet_address: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Approve KYC request (admin only)"""
    try:
        result = await db.users.update_one(
            {"wallet_address": wallet_address.lower()},
            {"$set": {
                "kyc_status": "approved",
                "kyc_approved_at": datetime.now(timezone.utc).isoformat(),
                "kyc_documents.$[].verified": True
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"success": True, "message": "KYC approved"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Approve KYC error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/kyc/{wallet_address}/reject")
async def reject_kyc(
    wallet_address: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    reason: str = Query(..., description="Rejection reason")
):
    """Reject KYC request (admin only)"""
    try:
        result = await db.users.update_one(
            {"wallet_address": wallet_address.lower()},
            {"$set": {
                "kyc_status": "rejected",
                "kyc_rejection_reason": reason,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"success": True, "message": "KYC rejected"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reject KYC error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics")
async def get_analytics(db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get platform analytics (admin only)"""
    try:
        # Get counts
        total_users = await db.users.count_documents({})
        total_properties = await db.properties.count_documents({})
        active_properties = await db.properties.count_documents({"status": "active"})
        
        # Get transactions stats
        transactions = await db.transactions.find(
            {"status": "confirmed"},
            {"_id": 0, "total_amount": 1, "created_at": 1}
        ).to_list(10000)
        
        total_volume = sum(tx.get("total_amount", 0) for tx in transactions)
        total_transactions = len(transactions)
        
        # Get recent transactions (last 30 days)
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        recent_transactions = [
            tx for tx in transactions
            if datetime.fromisoformat(tx["created_at"].replace('Z', '+00:00')) > thirty_days_ago
        ]
        recent_volume = sum(tx.get("total_amount", 0) for tx in recent_transactions)
        
        # KYC stats
        kyc_pending = await db.users.count_documents({"kyc_status": "pending"})
        kyc_approved = await db.users.count_documents({"kyc_status": "approved"})
        
        return {
            "users": {
                "total": total_users,
                "kyc_pending": kyc_pending,
                "kyc_approved": kyc_approved
            },
            "properties": {
                "total": total_properties,
                "active": active_properties
            },
            "transactions": {
                "total": total_transactions,
                "total_volume": total_volume,
                "recent_30d": len(recent_transactions),
                "recent_volume_30d": recent_volume
            }
        }
    except Exception as e:
        logger.error(f"Get analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/properties/{property_id}")
async def delete_property(property_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Delete a property (admin only)"""
    try:
        result = await db.properties.delete_one({"id": property_id})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Property not found")
        
        return {"success": True, "message": "Property deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete property error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
