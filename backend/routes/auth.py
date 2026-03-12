from fastapi import APIRouter, HTTPException, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
from datetime import datetime, timezone
import os
import logging
from blockchain.wallet_manager import WalletManager
from models.user import User, UserCreate
from database import get_database

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

# Initialize wallet manager
RPC_URL = os.getenv('POLYGON_RPC_URL', 'https://polygon-amoy.drpc.org')
wallet_manager = WalletManager(RPC_URL)

class ConnectWalletRequest(BaseModel):
    wallet_address: str
    signature: str
    message: str

class VerifySignatureRequest(BaseModel):
    wallet_address: str
    signature: str
    message: str

@router.post("/connect-wallet")
async def connect_wallet(request: ConnectWalletRequest, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Connect wallet and create/update user"""
    try:
        # Verify signature
        is_valid = wallet_manager.verify_signature(
            request.message,
            request.signature,
            request.wallet_address
        )
        
        if not is_valid:
            raise HTTPException(status_code=401, detail="Invalid signature")
        
        # Check if user exists
        user_doc = await db.users.find_one(
            {"wallet_address": request.wallet_address.lower()},
            {"_id": 0}
        )
        
        if user_doc:
            # Update last login
            await db.users.update_one(
                {"wallet_address": request.wallet_address.lower()},
                {"$set": {"last_login": datetime.now(timezone.utc).isoformat()}}
            )
            user = User(**user_doc)
        else:
            # Create new user
            new_user = User(
                wallet_address=request.wallet_address.lower(),
                kyc_status="not_submitted"
            )
            user_dict = new_user.model_dump()
            user_dict['created_at'] = user_dict['created_at'].isoformat()
            user_dict['updated_at'] = user_dict['updated_at'].isoformat()
            await db.users.insert_one(user_dict)
            user = new_user
        
        return {
            "success": True,
            "user": user,
            "message": "Wallet connected successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Connect wallet error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/verify-signature")
async def verify_signature(request: VerifySignatureRequest):
    """Verify a wallet signature"""
    try:
        is_valid = wallet_manager.verify_signature(
            request.message,
            request.signature,
            request.wallet_address
        )
        
        return {
            "valid": is_valid,
            "wallet_address": request.wallet_address if is_valid else None
        }
    except Exception as e:
        logger.error(f"Verify signature error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/profile/{wallet_address}")
async def get_profile(wallet_address: str, db: AsyncIOMotorDatabase = Depends(get_database)):
    """Get user profile"""
    try:
        user_doc = await db.users.find_one(
            {"wallet_address": wallet_address.lower()},
            {"_id": 0}
        )
        
        if not user_doc:
            raise HTTPException(status_code=404, detail="User not found")
        
        return User(**user_doc)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get profile error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/balance/{wallet_address}")
async def get_wallet_balance(wallet_address: str):
    """Get wallet MATIC balance"""
    try:
        if not wallet_manager.is_valid_address(wallet_address):
            raise HTTPException(status_code=400, detail="Invalid wallet address")
        
        matic_balance, wei_balance = wallet_manager.get_balance(wallet_address)
        
        return {
            "wallet_address": wallet_address,
            "matic_balance": matic_balance,
            "wei_balance": wei_balance,
            "currency": "MATIC"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get balance error: {e}")
        raise HTTPException(status_code=500, detail=str(e))