from fastapi import APIRouter, HTTPException, Query, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from datetime import datetime, timezone
import logging
from models.reservation import Reservation, ReservationCreate
from models.property import Property
from database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reservations", tags=["Reservations"])

@router.post("/", response_model=Reservation)
async def create_reservation(request: ReservationCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Create a token reservation"""
    try:
        # Get property
        property_doc = await db.properties.find_one(
            {"id": request.property_id},
            {"_id": 0}
        )
        
        if not property_doc:
            raise HTTPException(status_code=404, detail="Property not found")
        
        property_obj = Property(**property_doc)
        
        # Check availability
        if property_obj.available_tokens < request.token_amount:
            raise HTTPException(
                status_code=400,
                detail=f"Only {property_obj.available_tokens} tokens available"
            )
        
        # Check for existing active reservation
        existing = await db.reservations.find_one({
            "user_wallet": request.wallet_address.lower(),
            "property_id": request.property_id,
            "status": "active"
        })
        
        if existing:
            raise HTTPException(
                status_code=400,
                detail="You already have an active reservation for this property"
            )
        
        # Create reservation
        total_amount = property_obj.token_price * request.token_amount
        
        reservation = Reservation(
            user_wallet=request.wallet_address.lower(),
            property_id=property_obj.id,
            property_name=property_obj.name,
            token_amount=request.token_amount,
            reserved_price=property_obj.token_price,
            total_amount=total_amount
        )
        
        reservation_dict = reservation.model_dump()
        reservation_dict['created_at'] = reservation_dict['created_at'].isoformat()
        reservation_dict['expires_at'] = reservation_dict['expires_at'].isoformat()
        if reservation_dict.get('completed_at'):
            reservation_dict['completed_at'] = reservation_dict['completed_at'].isoformat()
        
        await db.reservations.insert_one(reservation_dict)
        
        return reservation
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Create reservation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wallet/{wallet_address}", response_model=List[Reservation])
async def get_user_reservations(wallet_address: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get all reservations for a user"""
    try:
        reservations = await db.reservations.find(
            {"user_wallet": wallet_address.lower()},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        # Update expired reservations
        now = datetime.now(timezone.utc)
        for reservation in reservations:
            expires_at = datetime.fromisoformat(reservation['expires_at'].replace('Z', '+00:00'))
            if reservation['status'] == 'active' and expires_at < now:
                await db.reservations.update_one(
                    {"id": reservation['id']},
                    {"$set": {"status": "expired"}}
                )
                reservation['status'] = 'expired'
        
        return [Reservation(**res) for res in reservations]
    except Exception as e:
        logger.error(f"Get user reservations error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{reservation_id}/cancel")
async def cancel_reservation(reservation_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Cancel a reservation"""
    try:
        result = await db.reservations.update_one(
            {"id": reservation_id, "status": "active"},
            {"$set": {"status": "cancelled"}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Reservation not found or already processed"
            )
        
        return {"success": True, "message": "Reservation cancelled"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cancel reservation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{reservation_id}/complete")
async def complete_reservation(
    reservation_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    transaction_id: str = Query(..., description="Transaction ID")
):
    """Mark reservation as completed after purchase"""
    try:
        result = await db.reservations.update_one(
            {"id": reservation_id, "status": "active"},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.modified_count == 0:
            raise HTTPException(
                status_code=404,
                detail="Reservation not found or already processed"
            )
        
        return {"success": True, "message": "Reservation completed"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Complete reservation error: {e}")
        raise HTTPException(status_code=500, detail=str(e))