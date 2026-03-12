from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from typing import List
from datetime import datetime, timezone
import logging
import os
from models.transaction import Transaction, TransactionCreate, PurchaseRequest
from models.property import Property
from blockchain.wallet_manager import WalletManager
from blockchain.contract_manager import ContractManager
from database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transactions", tags=["Transactions"])

# Initialize managers
RPC_URL = os.getenv('POLYGON_RPC_URL', 'https://polygon-amoy.drpc.org')
wallet_manager = WalletManager(RPC_URL)
contract_manager = ContractManager(RPC_URL)

@router.post("/purchase")
async def purchase_tokens(request: PurchaseRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Purchase property tokens"""
    try:
        # Verify signature
        is_valid = wallet_manager.verify_signature(
            f"Purchase {request.token_amount} tokens",
            request.signature,
            request.wallet_address
        )
        
        if not is_valid:
            raise HTTPException(status_code=401, detail="Invalid signature")
        
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
        
        # Calculate total
        total_amount = property_obj.token_price * request.token_amount
        
        # Simulate blockchain transaction
        tx_result = await contract_manager.simulate_token_transfer(
            from_addr=request.wallet_address,
            to_addr=request.wallet_address,
            token_id=property_obj.id,
            amount=request.token_amount
        )
        
        if not tx_result.get("success"):
            raise HTTPException(
                status_code=500,
                detail="Blockchain transaction failed"
            )
        
        # Create transaction record
        transaction = Transaction(
            tx_hash=tx_result["tx_hash"],
            from_address=request.wallet_address,
            to_address=request.wallet_address,
            transaction_type="purchase",
            property_id=property_obj.id,
            property_name=property_obj.name,
            token_amount=request.token_amount,
            price_per_token=property_obj.token_price,
            total_amount=total_amount,
            payment_method=request.payment_method,
            status="confirmed"
        )
        
        tx_dict = transaction.model_dump()
        tx_dict['created_at'] = tx_dict['created_at'].isoformat()
        if tx_dict.get('confirmed_at'):
            tx_dict['confirmed_at'] = tx_dict['confirmed_at'].isoformat()
        
        await db.transactions.insert_one(tx_dict)
        
        # Update property available tokens
        new_available = property_obj.available_tokens - request.token_amount
        await db.properties.update_one(
            {"id": property_obj.id},
            {"$set": {
                "available_tokens": new_available,
                "status": "sold_out" if new_available == 0 else "active"
            }}
        )
        
        # Update user portfolio
        await db.users.update_one(
            {"wallet_address": request.wallet_address.lower()},
            {
                "$inc": {
                    "total_invested": total_amount,
                    "portfolio_value": total_amount
                }
            }
        )
        
        return {
            "success": True,
            "transaction": transaction,
            "message": "Purchase successful"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Purchase tokens error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/wallet/{wallet_address}", response_model=List[Transaction])
async def get_wallet_transactions(
    wallet_address: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    limit: int = 50
):
    """Get all transactions for a wallet"""
    try:
        transactions = await db.transactions.find(
            {"from_address": wallet_address.lower()},
            {"_id": 0}
        ).sort("created_at", -1).limit(limit).to_list(limit)
        
        return [Transaction(**tx) for tx in transactions]
    except Exception as e:
        logger.error(f"Get wallet transactions error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/status/{tx_hash}")
async def get_transaction_status(tx_hash: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get transaction status"""
    try:
        # Check database first
        tx_doc = await db.transactions.find_one(
            {"tx_hash": tx_hash},
            {"_id": 0}
        )
        
        if tx_doc:
            return Transaction(**tx_doc)
        
        # Check blockchain
        blockchain_status = wallet_manager.get_transaction_status(tx_hash)
        return blockchain_status
    except Exception as e:
        logger.error(f"Get transaction status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/portfolio/{wallet_address}")
async def get_portfolio(wallet_address: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get user's token portfolio"""
    try:
        # Get all purchase transactions
        purchases = await db.transactions.find(
            {
                "from_address": wallet_address.lower(),
                "transaction_type": "purchase",
                "status": "confirmed"
            },
            {"_id": 0}
        ).to_list(1000)
        
        # Aggregate by property
        portfolio = {}
        for tx in purchases:
            prop_id = tx["property_id"]
            if prop_id not in portfolio:
                portfolio[prop_id] = {
                    "property_id": prop_id,
                    "property_name": tx["property_name"],
                    "total_tokens": 0,
                    "total_invested": 0,
                    "average_price": 0
                }
            portfolio[prop_id]["total_tokens"] += tx["token_amount"]
            portfolio[prop_id]["total_invested"] += tx["total_amount"]
        
        # Calculate averages
        for prop_id, data in portfolio.items():
            data["average_price"] = data["total_invested"] / data["total_tokens"]
        
        # Get property details
        for prop_id in portfolio.keys():
            prop_doc = await db.properties.find_one(
                {"id": prop_id},
                {"_id": 0, "name": 1, "images": 1, "financials": 1, "location": 1}
            )
            if prop_doc:
                portfolio[prop_id]["property_details"] = prop_doc
        
        return {
            "wallet_address": wallet_address,
            "portfolio": list(portfolio.values()),
            "total_properties": len(portfolio)
        }
    except Exception as e:
        logger.error(f"Get portfolio error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
