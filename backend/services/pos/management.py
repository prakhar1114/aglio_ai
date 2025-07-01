from typing import Dict, Optional
from sqlalchemy.orm import Session
from uuid import uuid4

from models.schema import POSSystem, Restaurant


def create_pos_system(
    restaurant_id: int,
    pos_name: str,
    config: Dict,
    db: Session,
    is_active: bool = True
) -> POSSystem:
    """Create a new POS system configuration
    
    Args:
        restaurant_id (int): Restaurant ID
        pos_name (str): Name of the POS system (e.g., "petpooja")
        config (Dict): POS configuration including API keys, endpoints, etc.
        db (Session): Database session
        is_active (bool): Whether the POS system is active
        
    Returns:
        POSSystem: Created POS system
    """
    
    # Check if restaurant exists
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise ValueError(f"Restaurant with ID {restaurant_id} not found")
    
    # Check if POS system already exists for this restaurant
    existing = db.query(POSSystem).filter(
        POSSystem.restaurant_id == restaurant_id,
        POSSystem.name == pos_name
    ).first()
    
    if existing:
        raise ValueError(f"POS system '{pos_name}' already exists for restaurant {restaurant_id}")
    
    pos_system = POSSystem(
        name=pos_name,
        restaurant_id=restaurant_id,
        config=config,
        is_active=is_active
    )
    
    db.add(pos_system)
    db.commit()
    db.refresh(pos_system)
    
    return pos_system


def update_pos_system_config(
    pos_system_id: int,
    config: Dict,
    db: Session,
    is_active: Optional[bool] = None
) -> POSSystem:
    """Update POS system configuration
    
    Args:
        pos_system_id (int): POS system ID
        config (Dict): New configuration
        db (Session): Database session
        is_active (Optional[bool]): Update active status if provided
        
    Returns:
        POSSystem: Updated POS system
    """
    
    pos_system = db.query(POSSystem).filter(POSSystem.id == pos_system_id).first()
    if not pos_system:
        raise ValueError(f"POS system with ID {pos_system_id} not found")
    
    pos_system.config = config
    if is_active is not None:
        pos_system.is_active = is_active
    
    db.commit()
    db.refresh(pos_system)
    
    return pos_system


def get_pos_systems_for_restaurant(restaurant_id: int, db: Session) -> list[POSSystem]:
    """Get all POS systems for a restaurant
    
    Args:
        restaurant_id (int): Restaurant ID
        db (Session): Database session
        
    Returns:
        list[POSSystem]: List of POS systems
    """
    
    return db.query(POSSystem).filter(
        POSSystem.restaurant_id == restaurant_id
    ).all()


def create_petpooja_pos_system(
    restaurant_id: int,
    app_key: str,
    app_secret: str,
    access_token: str,
    petpooja_restaurant_id: str,
    db: Session,
    menu_endpoint,
    order_endpoint
) -> POSSystem:
    """Create a PetPooja POS system with proper configuration
    
    Args:
        restaurant_id (int): Internal restaurant ID
        app_key (str): PetPooja app key
        app_secret (str): PetPooja app secret
        access_token (str): PetPooja access token
        petpooja_restaurant_id (str): PetPooja restaurant ID
        db (Session): Database session
        menu_endpoint (str): PetPooja menu API endpoint
        order_endpoint (str): PetPooja order API endpoint
        
    Returns:
        POSSystem: Created POS system
    """
    
    config = {
        "app_key": app_key,
        "app_secret": app_secret,
        "access_token": access_token,
        "restaurant_id": petpooja_restaurant_id,
        "menu_endpoint": menu_endpoint,
        "order_endpoint": order_endpoint
    }
    
    return create_pos_system(
        restaurant_id=restaurant_id,
        pos_name="petpooja",
        config=config,
        db=db
    ) 