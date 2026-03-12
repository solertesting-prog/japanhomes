from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime, timezone
import uuid

class PropertyImage(BaseModel):
    url: str
    alt: str
    is_primary: bool = False

class PropertyLocation(BaseModel):
    address: str
    city: str
    prefecture: str
    postal_code: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class PropertyFinancials(BaseModel):
    purchase_price: float
    current_valuation: float
    annual_yield: float
    projected_appreciation: float
    rental_income_monthly: Optional[float] = None

class Property(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    property_type: str  # apartment, house, commercial, land
    location: PropertyLocation
    financials: PropertyFinancials
    images: List[PropertyImage]
    
    # Tokenization details
    total_tokens: int
    available_tokens: int
    token_price: float
    min_purchase: int = 1
    
    # Property details
    size_sqm: float
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    year_built: Optional[int] = None
    
    # Status
    status: str = "active"  # active, sold_out, pending, inactive
    featured: bool = False
    
    # Blockchain
    contract_address: Optional[str] = None
    token_id: Optional[str] = None
    chain_id: int = 80002  # Polygon Amoy testnet
    
    # Metadata
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: Optional[str] = None

class PropertyCreate(BaseModel):
    name: str
    description: str
    property_type: str
    location: PropertyLocation
    financials: PropertyFinancials
    images: List[PropertyImage]
    total_tokens: int
    token_price: float
    size_sqm: float
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    year_built: Optional[int] = None
    featured: bool = False

class PropertyUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    featured: Optional[bool] = None
    financials: Optional[PropertyFinancials] = None
    available_tokens: Optional[int] = None