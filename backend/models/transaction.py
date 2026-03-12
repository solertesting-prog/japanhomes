from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone
import uuid

class Transaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    tx_hash: str
    from_address: str
    to_address: Optional[str] = None
    
    # Transaction details
    transaction_type: str  # purchase, sale, transfer, reservation
    property_id: str
    property_name: str
    token_amount: int
    price_per_token: float
    total_amount: float
    
    # Payment details
    payment_method: str  # crypto, fiat, stripe
    currency: str = "MATIC"
    
    # Status
    status: str = "pending"  # pending, confirmed, failed, cancelled
    confirmations: int = 0
    
    # Blockchain
    block_number: Optional[int] = None
    gas_used: Optional[int] = None
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    confirmed_at: Optional[datetime] = None

class TransactionCreate(BaseModel):
    from_address: str
    to_address: Optional[str] = None
    transaction_type: str
    property_id: str
    token_amount: int
    payment_method: str
    currency: str = "MATIC"

class PurchaseRequest(BaseModel):
    property_id: str
    token_amount: int
    wallet_address: str
    payment_method: str
    signature: str