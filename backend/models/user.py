from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid

class KYCDocument(BaseModel):
    document_type: str  # passport, drivers_license, national_id
    document_number: str
    document_url: str
    verified: bool = False

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    wallet_address: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    
    # KYC
    kyc_status: str = "pending"  # pending, approved, rejected, not_submitted
    kyc_documents: List[KYCDocument] = []
    kyc_submitted_at: Optional[datetime] = None
    kyc_approved_at: Optional[datetime] = None
    
    # User role
    role: str = "user"  # user, admin
    
    # Portfolio
    total_invested: float = 0.0
    portfolio_value: float = 0.0
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_login: Optional[datetime] = None

class UserCreate(BaseModel):
    wallet_address: str
    email: Optional[str] = None
    full_name: Optional[str] = None

class UserUpdate(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None

class KYCSubmission(BaseModel):
    full_name: str
    email: str
    document_type: str
    document_number: str
    document_url: str