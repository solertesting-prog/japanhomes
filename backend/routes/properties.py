from fastapi import APIRouter, HTTPException, Query, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List, Optional
from datetime import datetime, timezone
import logging
from models.property import Property, PropertyCreate, PropertyUpdate
from blockchain.contract_manager import ContractManager
from database import get_database
import os

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/properties", tags=["Properties"])

# Initialize contract manager
RPC_URL = os.getenv('POLYGON_RPC_URL', 'https://polygon-amoy.drpc.org')
contract_manager = ContractManager(RPC_URL)

@router.get("/", response_model=List[Property])
async def get_properties(
    db: AsyncIOMotorDatabase = Depends(get_database),
    city: Optional[str] = None,
    property_type: Optional[str] = None,
    min_yield: Optional[float] = None,
    max_price: Optional[float] = None,
    status: str = "active",
    featured: Optional[bool] = None,
    skip: int = 0,
    limit: int = 20
):
    """Get all properties with filters"""
    try:
        # Build query
        query = {"status": status}
        
        if city:
            query["location.city"] = {"$regex": city, "$options": "i"}
        if property_type:
            query["property_type"] = property_type
        if min_yield:
            query["financials.annual_yield"] = {"$gte": min_yield}
        if max_price:
            query["token_price"] = {"$lte": max_price}
        if featured is not None:
            query["featured"] = featured
        
        # Execute query
        properties = await db.properties.find(
            query,
            {"_id": 0}
        ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
        
        return [Property(**prop) for prop in properties]
    except Exception as e:
        logger.error(f"Get properties error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{property_id}", response_model=Property)
async def get_property(property_id: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get single property by ID"""
    try:
        property_doc = await db.properties.find_one(
            {"id": property_id},
            {"_id": 0}
        )
        
        if not property_doc:
            raise HTTPException(status_code=404, detail="Property not found")
        
        return Property(**property_doc)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get property error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/", response_model=Property)
async def create_property(
    property_data: PropertyCreate,
    db: AsyncIOMotorDatabase = Depends(get_database),
    created_by: str = Query(..., description="Admin wallet address")
):
    """Create new property (admin only)"""
    try:
        # Create property object
        new_property = Property(
            **property_data.model_dump(),
            available_tokens=property_data.total_tokens,
            created_by=created_by
        )
        
        # Save to database
        property_dict = new_property.model_dump()
        property_dict['created_at'] = property_dict['created_at'].isoformat()
        property_dict['updated_at'] = property_dict['updated_at'].isoformat()
        
        await db.properties.insert_one(property_dict)
        
        # Simulate token creation on blockchain
        token_result = await contract_manager.simulate_token_creation(property_dict)
        
        if token_result.get("success"):
            # Update with blockchain data
            await db.properties.update_one(
                {"id": new_property.id},
                {"$set": {
                    "token_id": token_result.get("token_id"),
                    "contract_address": token_result.get("tx_hash")
                }}
            )
        
        return new_property
    except Exception as e:
        logger.error(f"Create property error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/{property_id}", response_model=Property)
async def update_property(
    property_id: str,
    update_data: PropertyUpdate,
    db: AsyncIOMotorDatabase = Depends(get_database)
):
    """Update property (admin only)"""
    try:
        # Check if property exists
        existing = await db.properties.find_one({"id": property_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Property not found")
        
        # Update fields
        update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
        if update_dict:
            update_dict['updated_at'] = datetime.now(timezone.utc).isoformat()
            
            # Handle nested objects
            if 'financials' in update_dict:
                update_dict['financials'] = update_dict['financials'].model_dump()
            
            await db.properties.update_one(
                {"id": property_id},
                {"$set": update_dict}
            )
        
        # Get updated property
        updated_doc = await db.properties.find_one(
            {"id": property_id},
            {"_id": 0}
        )
        
        return Property(**updated_doc)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update property error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/featured/list", response_model=List[Property])
async def get_featured_properties(db: AsyncIOMotorDatabase = Depends(get_database), limit: int = 6):
    """Get featured properties for landing page"""
    try:
        properties = await db.properties.find(
            {"featured": True, "status": "active"},
            {"_id": 0}
        ).limit(limit).to_list(limit)
        
        return [Property(**prop) for prop in properties]
    except Exception as e:
        logger.error(f"Get featured properties error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
