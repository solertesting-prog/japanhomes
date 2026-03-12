import asyncio
import sys
sys.path.append('/app/backend')

from motor.motor_asyncio import AsyncIOMotorClient
import os
from datetime import datetime, timezone
import uuid

# Sample properties for Japan
sample_properties = [
    {
        "id": str(uuid.uuid4()),
        "name": "Modern Tokyo Sky Apartment",
        "description": "Luxurious 3-bedroom apartment in the heart of Shibuya with stunning city views. Perfect for investment with high rental demand.",
        "property_type": "apartment",
        "location": {
            "address": "1-2-3 Shibuya",
            "city": "Tokyo",
            "prefecture": "Tokyo",
            "postal_code": "150-0002",
            "latitude": 35.6595,
            "longitude": 139.7004
        },
        "financials": {
            "purchase_price": 500000,
            "current_valuation": 550000,
            "annual_yield": 5.2,
            "projected_appreciation": 8.5,
            "rental_income_monthly": 3200
        },
        "images": [
            {"url": "https://images.unsplash.com/photo-1771064252231-234d844a0e00?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzh8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0b2t5byUyMGFyY2hpdGVjdHVyZSUyMHNreXNjcmFwZXIlMjBuaWdodHxlbnwwfHx8fDE3NzMzMjIyNTB8MA&ixlib=rb-4.1.0&q=85", "alt": "Tokyo Apartment Exterior", "is_primary": True},
            {"url": "https://images.unsplash.com/photo-1610375233775-6e0166927193?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBsdXh1cnklMjBtaW5pbWFsaXN0JTIwYXBhcnRtZW50JTIwaW50ZXJpb3IlMjBqYXBhbnxlbnwwfHx8fDE3NzMzMjIyNjN8MA&ixlib=rb-4.1.0&q=85", "alt": "Interior View", "is_primary": False}
        ],
        "total_tokens": 1000,
        "available_tokens": 1000,
        "token_price": 550,
        "min_purchase": 1,
        "size_sqm": 120,
        "bedrooms": 3,
        "bathrooms": 2,
        "year_built": 2020,
        "status": "active",
        "featured": True,
        "contract_address": None,
        "token_id": None,
        "chain_id": 80002,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "admin"
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Traditional Kyoto Machiya",
        "description": "Beautifully restored traditional Japanese townhouse in historic Gion district. Ideal for cultural tourism and Airbnb.",
        "property_type": "house",
        "location": {
            "address": "4-5-6 Gion",
            "city": "Kyoto",
            "prefecture": "Kyoto",
            "postal_code": "605-0073",
            "latitude": 35.0036,
            "longitude": 135.7753
        },
        "financials": {
            "purchase_price": 400000,
            "current_valuation": 450000,
            "annual_yield": 6.5,
            "projected_appreciation": 7.0,
            "rental_income_monthly": 2800
        },
        "images": [
            {"url": "https://images.unsplash.com/photo-1756621609061-2df2cc8cf827?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwyfHx0cmFkaXRpb25hbCUyMGt5b3RvJTIwbWFjaGl5YSUyMGhvdXNlJTIwZ2FyZGVufGVufDB8fHx8MTc3MzMyMjI1MXww&ixlib=rb-4.1.0&q=85", "alt": "Kyoto Machiya", "is_primary": True}
        ],
        "total_tokens": 800,
        "available_tokens": 800,
        "token_price": 562.5,
        "min_purchase": 1,
        "size_sqm": 95,
        "bedrooms": 2,
        "bathrooms": 1,
        "year_built": 1950,
        "status": "active",
        "featured": True,
        "contract_address": None,
        "token_id": None,
        "chain_id": 80002,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "admin"
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Osaka Commercial Space",
        "description": "Prime retail location in Namba district. High foot traffic area with established tenant paying premium rent.",
        "property_type": "commercial",
        "location": {
            "address": "7-8-9 Namba",
            "city": "Osaka",
            "prefecture": "Osaka",
            "postal_code": "542-0076",
            "latitude": 34.6660,
            "longitude": 135.5018
        },
        "financials": {
            "purchase_price": 750000,
            "current_valuation": 780000,
            "annual_yield": 7.8,
            "projected_appreciation": 5.5,
            "rental_income_monthly": 5000
        },
        "images": [
            {"url": "https://images.unsplash.com/photo-1764268845537-f3ce51fd6a6b?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzh8MHwxfHNlYXJjaHwzfHxtb2Rlcm4lMjB0b2t5byUyMGFyY2hpdGVjdHVyZSUyMHNreXNjcmFwZXIlMjBuaWdodHxlbnwwfHx8fDE3NzMzMjIyNTB8MA&ixlib=rb-4.1.0&q=85", "alt": "Commercial Building", "is_primary": True}
        ],
        "total_tokens": 1500,
        "available_tokens": 1500,
        "token_price": 520,
        "min_purchase": 1,
        "size_sqm": 200,
        "bedrooms": None,
        "bathrooms": 2,
        "year_built": 2018,
        "status": "active",
        "featured": True,
        "contract_address": None,
        "token_id": None,
        "chain_id": 80002,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "admin"
    },
    {
        "id": str(uuid.uuid4()),
        "name": "Yokohama Bay View Condo",
        "description": "Waterfront condominium with panoramic ocean views. Modern amenities and close to business district.",
        "property_type": "apartment",
        "location": {
            "address": "10-11-12 Minato Mirai",
            "city": "Yokohama",
            "prefecture": "Kanagawa",
            "postal_code": "220-0012",
            "latitude": 35.4545,
            "longitude": 139.6380
        },
        "financials": {
            "purchase_price": 600000,
            "current_valuation": 620000,
            "annual_yield": 4.8,
            "projected_appreciation": 6.2,
            "rental_income_monthly": 2900
        },
        "images": [
            {"url": "https://images.unsplash.com/photo-1771064252231-234d844a0e00?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzh8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjB0b2t5byUyMGFyY2hpdGVjdHVyZSUyMHNreXNjcmFwZXIlMjBuaWdodHxlbnwwfHx8fDE3NzMzMjIyNTB8MA&ixlib=rb-4.1.0&q=85", "alt": "Yokohama Condo", "is_primary": True}
        ],
        "total_tokens": 1200,
        "available_tokens": 1200,
        "token_price": 516.67,
        "min_purchase": 1,
        "size_sqm": 110,
        "bedrooms": 2,
        "bathrooms": 2,
        "year_built": 2019,
        "status": "active",
        "featured": False,
        "contract_address": None,
        "token_id": None,
        "chain_id": 80002,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_by": "admin"
    }
]

async def seed_database():
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print(f"Connected to MongoDB: {mongo_url}/{db_name}")
    
    # Clear existing properties
    result = await db.properties.delete_many({})
    print(f"Deleted {result.deleted_count} existing properties")
    
    # Insert sample properties
    result = await db.properties.insert_many(sample_properties)
    print(f"Inserted {len(result.inserted_ids)} sample properties")
    
    # Verify
    count = await db.properties.count_documents({})
    print(f"Total properties in database: {count}")
    
    client.close()
    print("Database seeding completed!")

if __name__ == "__main__":
    asyncio.run(seed_database())
