from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from datetime import datetime, timezone
import logging
from models.favorite import Favorite, FavoriteCreate
from models.property import Property
from database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/favorites", tags=["Favorites"])

@router.post("/", response_model=Favorite)
async def add_favorite(request: FavoriteCreate, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Add a property to favorites"""
    try:
        # Check if property exists
        property_doc = await db.properties.find_one(
            {"id": request.property_id},
            {"_id": 0, "name": 1}
        )
        
        if not property_doc:
            raise HTTPException(status_code=404, detail="Property not found")
        
        # Check if already favorited
        existing = await db.favorites.find_one({
            "user_wallet": request.wallet_address.lower(),
            "property_id": request.property_id
        })
        
        if existing:
            raise HTTPException(status_code=400, detail="Property already in favorites")
        
        # Create favorite
        favorite = Favorite(
            user_wallet=request.wallet_address.lower(),
            property_id=request.property_id,
            property_name=property_doc["name"],
            notification_enabled=request.notification_enabled
        )
        
        favorite_dict = favorite.model_dump()
        favorite_dict['created_at'] = favorite_dict['created_at'].isoformat()
        
        await db.favorites.insert_one(favorite_dict)
        
        return favorite
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Add favorite error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wallet/{wallet_address}", response_model=List[Favorite])
async def get_user_favorites(wallet_address: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get all favorites for a user"""
    try:
        favorites = await db.favorites.find(
            {"user_wallet": wallet_address.lower()},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        return [Favorite(**fav) for fav in favorites]
    except Exception as e:
        logger.error(f"Get favorites error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wallet/{wallet_address}/details")
async def get_favorites_with_details(wallet_address: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get favorites with full property details"""
    try:
        favorites = await db.favorites.find(
            {"user_wallet": wallet_address.lower()},
            {"_id": 0}
        ).sort("created_at", -1).to_list(100)
        
        result = []
        for fav in favorites:
            # Get property details
            property_doc = await db.properties.find_one(
                {"id": fav["property_id"]},
                {"_id": 0}
            )
            
            if property_doc:
                result.append({
                    "favorite": Favorite(**fav),
                    "property": Property(**property_doc)
                })
        
        return result
    except Exception as e:
        logger.error(f"Get favorites with details error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{property_id}")
async def remove_favorite(
    property_id: str,
    wallet_address: str,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Remove a property from favorites"""
    try:
        result = await db.favorites.delete_one({
            "user_wallet": wallet_address.lower(),
            "property_id": property_id
        })
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Favorite not found")
        
        return {"success": True, "message": "Removed from favorites"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Remove favorite error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{property_id}/notifications")
async def toggle_notifications(
    property_id: str,
    wallet_address: str,
    enabled: bool,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Toggle notifications for a favorite"""
    try:
        result = await db.favorites.update_one(
            {
                "user_wallet": wallet_address.lower(),
                "property_id": property_id
            },
            {"$set": {"notification_enabled": enabled}}
        )
        
        if result.modified_count == 0:
            raise HTTPException(status_code=404, detail="Favorite not found")
        
        return {"success": True, "notification_enabled": enabled}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Toggle notifications error: {e}")
        raise HTTPException(status_code=500, detail=str(e))