from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid

class Reservation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_wallet: str
    property_id: str
    property_name: str
    
    # Reservation details
    token_amount: int
    reserved_price: float
    total_amount: float
    
    # Status
    status: str = "active"  # active, completed, expired, cancelled
    
    # Timing
    expires_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24)
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class ReservationCreate(BaseModel):
    property_id: str
    token_amount: int
    wallet_address: str