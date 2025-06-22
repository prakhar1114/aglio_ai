#!/usr/bin/env python3
"""
Setup test data for admin dashboard testing
"""

import uuid
from datetime import datetime
from sqlalchemy.orm import sessionmaker

from models.schema import Restaurant, Table, Session as TableSession, engine
from urls.admin.auth_utils import generate_api_key

# Create session
SessionLocal = sessionmaker(bind=engine)

def setup_test_restaurant():
    """Create a test restaurant with tables and API key"""
    db = SessionLocal()
    try:
        # Check if test restaurant already exists
        restaurant = db.query(Restaurant).filter(Restaurant.slug == "test-restaurant").first()
        
        if restaurant:
            print(f"✅ Test restaurant already exists: {restaurant.name}")
            print(f"🔑 API Key: {restaurant.api_key}")
            return restaurant.api_key
        
        # Create test restaurant
        api_key = generate_api_key()
        restaurant = Restaurant(
            public_id=str(uuid.uuid4()),
            slug="test-restaurant",
            name="Test Restaurant",
            tz="UTC",
            require_pass=False,
            api_key=api_key
        )
        
        db.add(restaurant)
        db.flush()  # Get the ID
        
        # Create test tables
        table_data = [
            {"number": 1, "status": "open"},
            {"number": 2, "status": "open"},
            {"number": 3, "status": "occupied"},  # We'll create a session for this
            {"number": 4, "status": "dirty"},
            {"number": 5, "status": "disabled"},
            {"number": 6, "status": "open"},
            {"number": 7, "status": "open"},
            {"number": 8, "status": "occupied"},  # We'll create a session for this
            {"number": 9, "status": "open"},
            {"number": 10, "status": "open"},
            {"number": 11, "status": "open"},
            {"number": 12, "status": "dirty"},
        ]
        
        tables = []
        for table_info in table_data:
            table = Table(
                public_id=str(uuid.uuid4()),
                restaurant_id=restaurant.id,
                number=table_info["number"],
                qr_token=f"test-qr-{table_info['number']}",
                status=table_info["status"]
            )
            db.add(table)
            tables.append(table)
        
        db.flush()  # Get table IDs
        
        # Create active sessions for occupied tables
        occupied_tables = [t for t in tables if t.status == "occupied"]
        for i, table in enumerate(occupied_tables):
            session = TableSession(
                public_id=str(uuid.uuid4()),
                restaurant_id=restaurant.id,
                table_id=table.id,
                state="active",
                created_at=datetime.utcnow(),
                last_activity_at=datetime.utcnow()
            )
            db.add(session)
        
        db.commit()
        
        print(f"✅ Created test restaurant: {restaurant.name}")
        print(f"🔑 API Key: {api_key}")
        print(f"📋 Created {len(tables)} tables")
        print(f"🪑 {len(occupied_tables)} tables have active sessions")
        print(f"🌐 Access admin dashboard at: http://localhost:8005/admin/login")
        
        return api_key
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error setting up test data: {e}")
        raise
    finally:
        db.close()

def main():
    """Main function"""
    print("🚀 Setting up admin dashboard test data...")
    
    try:
        api_key = setup_test_restaurant()
        
        print("\n" + "="*50)
        print("🎉 Test data setup complete!")
        print("="*50)
        print(f"Restaurant: Test Restaurant")
        print(f"API Key: {api_key}")
        print(f"Login URL: http://localhost:8005/admin/login")
        print(f"Dashboard URL: http://localhost:8005/admin/dashboard")
        print("\nTable Status Summary:")
        print("- Tables 1, 2, 6, 7, 9, 10, 11: Open (green)")
        print("- Tables 3, 8: Occupied (blue)")
        print("- Tables 4, 12: Dirty (yellow)")
        print("- Table 5: Disabled (gray)")
        print("\n💡 You can test the following actions:")
        print("- Close occupied tables (3, 8)")
        print("- Disable open tables")
        print("- Enable disabled table (5)")
        print("- Move parties between tables")
        print("- Clean dirty tables (4, 12)")
        
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        exit(1)

if __name__ == "__main__":
    main() 