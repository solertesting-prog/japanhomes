from pydantic import BaseModel, Field, ConfigDict
from typing import List
from datetime import datetime, timezone
import uuid

class Favorite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_wallet: str
    property_id: str
    property_name: str
    notification_enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FavoriteCreate(BaseModel):
    property_id: str
    wallet_address: str
    notification_enabled: bool = True