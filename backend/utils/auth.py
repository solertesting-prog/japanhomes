from fastapi import HTTPException, Header
from typing import Optional

# Simple admin check based on wallet address
# In production, this should use proper JWT tokens or OAuth
ADMIN_WALLETS = [
    "0xadmin123",  # Example admin wallet
    # Add more admin wallets here
]

async def verify_admin(x_wallet_address: Optional[str] = Header(None)) -> str:
    """
    Verify that the request is from an admin wallet
    In production, implement proper JWT/OAuth authentication
    """
    if not x_wallet_address:
        raise HTTPException(
            status_code=401,
            detail="Wallet address required. Send X-Wallet-Address header."
        )
    
    # For MVP, we'll allow any wallet to access admin (temporary)
    # In production, check against ADMIN_WALLETS list
    # if x_wallet_address.lower() not in [w.lower() for w in ADMIN_WALLETS]:
    #     raise HTTPException(
    #         status_code=403,
    #         detail="Admin access required"
    #     )
    
    return x_wallet_address

async def get_current_user(x_wallet_address: Optional[str] = Header(None)) -> Optional[str]:
    """
    Get current user from wallet address header
    """
    return x_wallet_address
