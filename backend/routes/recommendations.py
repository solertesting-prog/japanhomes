from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
import logging
from models.property import Property
from database import get_database
from collections import Counter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])

@router.get("/for-user/{wallet_address}", response_model=List[Property])
async def get_recommendations_for_user(
    wallet_address: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    limit: int = 6
):
    """Get personalized property recommendations based on user's favorites and purchases"""
    try:
        # Get user's favorites
        favorites = await db.favorites.find(
            {"user_wallet": wallet_address.lower()},
            {"_id": 0, "property_id": 1}
        ).to_list(100)
        
        favorite_ids = [fav["property_id"] for fav in favorites]
        
        # Get user's purchases
        purchases = await db.transactions.find(
            {
                "from_address": wallet_address.lower(),
                "transaction_type": "purchase",
                "status": "confirmed"
            },
            {"_id": 0, "property_id": 1}
        ).to_list(100)
        
        purchase_ids = [purchase["property_id"] for purchase in purchases]
        
        # Combine and get unique IDs
        all_user_property_ids = list(set(favorite_ids + purchase_ids))
        
        if not all_user_property_ids:
            # No history, return featured properties
            properties = await db.properties.find(
                {"status": "active", "featured": True},
                {"_id": 0}
            ).limit(limit).to_list(limit)
            return [Property(**prop) for prop in properties]
        
        # Get details of user's properties to understand preferences
        user_properties = await db.properties.find(
            {"id": {"$in": all_user_property_ids}},
            {"_id": 0}
        ).to_list(100)
        
        # Analyze preferences
        cities = [prop["location"]["city"] for prop in user_properties]
        property_types = [prop["property_type"] for prop in user_properties]
        
        # Count most common preferences
        city_preferences = Counter(cities).most_common(3)
        type_preferences = Counter(property_types).most_common(2)
        
        preferred_cities = [city for city, _ in city_preferences]
        preferred_types = [ptype for ptype, _ in type_preferences]
        
        # Calculate average yield preference
        yields = [prop["financials"]["annual_yield"] for prop in user_properties]
        avg_yield = sum(yields) / len(yields) if yields else 5.0
        
        # Build recommendation query
        query = {
            "status": "active",
            "id": {"$nin": all_user_property_ids},  # Exclude already owned/favorited
            "$or": [
                {"location.city": {"$in": preferred_cities}},
                {"property_type": {"$in": preferred_types}},
                {"financials.annual_yield": {"$gte": avg_yield - 1, "$lte": avg_yield + 2}}
            ]
        }
        
        # Get recommended properties
        recommendations = await db.properties.find(
            query,
            {"_id": 0}
        ).limit(limit * 2).to_list(limit * 2)
        
        # Score and sort recommendations
        scored_recommendations = []
        for prop in recommendations:
            score = 0
            
            # City match (highest weight)
            if prop["location"]["city"] in preferred_cities:
                city_rank = preferred_cities.index(prop["location"]["city"])
                score += (3 - city_rank) * 3
            
            # Property type match
            if prop["property_type"] in preferred_types:
                type_rank = preferred_types.index(prop["property_type"])
                score += (2 - type_rank) * 2
            
            # Yield similarity
            yield_diff = abs(prop["financials"]["annual_yield"] - avg_yield)
            if yield_diff < 1:
                score += 2
            elif yield_diff < 2:
                score += 1
            
            # Featured properties get bonus
            if prop.get("featured"):
                score += 1
            
            # High availability gets bonus
            availability_ratio = prop["available_tokens"] / prop["total_tokens"]
            if availability_ratio > 0.7:
                score += 1
            
            scored_recommendations.append((score, prop))
        
        # Sort by score and return top N
        scored_recommendations.sort(key=lambda x: x[0], reverse=True)
        top_recommendations = [prop for score, prop in scored_recommendations[:limit]]
        
        return [Property(**prop) for prop in top_recommendations]
        
    except Exception as e:
        logger.error(f"Get recommendations error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/similar/{property_id}", response_model=List[Property])
async def get_similar_properties(
    property_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    limit: int = 4
):
    """Get properties similar to a given property"""
    try:
        # Get the reference property
        ref_property = await db.properties.find_one(
            {"id": property_id},
            {"_id": 0}
        )
        
        if not ref_property:
            raise HTTPException(status_code=404, detail="Property not found")
        
        ref_city = ref_property["location"]["city"]
        ref_type = ref_property["property_type"]
        ref_yield = ref_property["financials"]["annual_yield"]
        ref_price = ref_property["token_price"]
        
        # Build similarity query
        query = {
            "status": "active",
            "id": {"$ne": property_id},
            "$or": [
                {"location.city": ref_city},
                {"property_type": ref_type},
                {
                    "financials.annual_yield": {
                        "$gte": ref_yield - 1.5,
                        "$lte": ref_yield + 1.5
                    }
                },
                {
                    "token_price": {
                        "$gte": ref_price * 0.8,
                        "$lte": ref_price * 1.2
                    }
                }
            ]
        }
        
        similar_properties = await db.properties.find(
            query,
            {"_id": 0}
        ).limit(limit * 2).to_list(limit * 2)
        
        # Score similarity
        scored_similar = []
        for prop in similar_properties:
            score = 0
            
            # Same city (highest match)
            if prop["location"]["city"] == ref_city:
                score += 4
            
            # Same type
            if prop["property_type"] == ref_type:
                score += 3
            
            # Similar yield
            yield_diff = abs(prop["financials"]["annual_yield"] - ref_yield)
            if yield_diff < 0.5:
                score += 3
            elif yield_diff < 1:
                score += 2
            elif yield_diff < 1.5:
                score += 1
            
            # Similar price
            price_ratio = prop["token_price"] / ref_price
            if 0.9 <= price_ratio <= 1.1:
                score += 2
            elif 0.8 <= price_ratio <= 1.2:
                score += 1
            
            scored_similar.append((score, prop))
        
        # Sort and return
        scored_similar.sort(key=lambda x: x[0], reverse=True)
        top_similar = [prop for score, prop in scored_similar[:limit]]
        
        return [Property(**prop) for prop in top_similar]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get similar properties error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/trending", response_model=List[Property])
async def get_trending_properties(
    db: AsyncIOMotorDatabase = Depends(get_database),
    limit: int = 6
):
    """Get trending properties based on recent activity"""
    try:
        # Get properties with recent transactions
        recent_transactions = await db.transactions.find(
            {"status": "confirmed"},
            {"_id": 0, "property_id": 1}
        ).sort("created_at", -1).limit(100).to_list(100)
        
        # Count transactions per property
        property_counts = Counter(tx["property_id"] for tx in recent_transactions)
        trending_property_ids = [pid for pid, _ in property_counts.most_common(limit)]
        
        if not trending_property_ids:
            # No transactions, return featured
            properties = await db.properties.find(
                {"status": "active", "featured": True},
                {"_id": 0}
            ).limit(limit).to_list(limit)
            return [Property(**prop) for prop in properties]
        
        # Get trending properties
        trending_properties = await db.properties.find(
            {"id": {"$in": trending_property_ids}, "status": "active"},
            {"_id": 0}
        ).to_list(limit)
        
        # Sort by transaction count
        sorted_trending = sorted(
            trending_properties,
            key=lambda p: property_counts.get(p["id"], 0),
            reverse=True
        )
        
        return [Property(**prop) for prop in sorted_trending]
        
    except Exception as e:
        logger.error(f"Get trending properties error: {e}")
        raise HTTPException(status_code=500, detail=str(e))