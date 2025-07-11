from typing import Dict, Type, Optional
from sqlalchemy.orm import Session

from .interface import POSInterface
from .petpooja import PetPoojaIntegration
from .petpooja_dinein import PetPoojaDiningIntegration
from models.schema import POSSystem


# Registry mapping POS system names to their integration classes
POS_INTEGRATIONS = {
    "petpooja": PetPoojaIntegration,
    "petpooja_dinein": PetPoojaDiningIntegration,
}


def get_pos_system(restaurant_id: int, pos_system_name: str, db: Session) -> POSSystem:
    """Get POS system configuration for a restaurant
    
    Args:
        restaurant_id (int): Restaurant ID
        pos_system_name (str): Name of the POS system (e.g., "petpooja")
        db (Session): Database session
        
    Returns:
        POSSystem: POS system configuration
        
    Raises:
        ValueError: If POS system not found
    """
    pos_system = db.query(POSSystem).filter(
        POSSystem.restaurant_id == restaurant_id,
        POSSystem.name == pos_system_name,
        POSSystem.is_active == True
    ).first()
    
    # if not pos_system:
    #     raise ValueError(f"No active POS system '{pos_system_name}' found for restaurant {restaurant_id}")
    
    return pos_system


def get_pos_integration(pos_system: POSSystem) -> Optional[POSInterface]:
    """Get POS integration instance for a POS system
    
    Args:
        pos_system (POSSystem): POS system configuration
        
    Returns:
        POSInterface: POS integration instance
        
    Raises:
        ValueError: If POS integration not found
    """
    integration_class = POS_INTEGRATIONS.get(pos_system.name)
    if not integration_class:
        raise ValueError(f"No integration found for POS system '{pos_system.name}'")
    
    return integration_class(pos_system)


def get_pos_integration_by_name(restaurant_id: int, pos_system_name: str, db: Session) -> Optional[POSInterface]:
    """Get POS integration instance by restaurant ID and POS system name
    
    Args:
        restaurant_id (int): Restaurant ID
        pos_system_name (str): Name of the POS system
        db (Session): Database session
        
    Returns:
        POSInterface: POS integration instance
        
    Raises:
        ValueError: If POS integration not found
    """
    # Get POS system from database
    pos_system = db.query(POSSystem).filter(
        POSSystem.restaurant_id == restaurant_id,
        POSSystem.name == pos_system_name,
        POSSystem.is_active == True
    ).first()
    
    if not pos_system:
        return None
        
    # Get integration instance
    return get_pos_integration(pos_system)


def get_any_pos_integration(restaurant_id: int, db: Session) -> Optional[POSInterface]:
    """Get any available POS integration for a restaurant
    
    Checks for both regular PetPooja and PetPooja dine-in integrations.
    
    Args:
        restaurant_id (int): Restaurant ID
        db (Session): Database session
        
    Returns:
        POSInterface: First available POS integration instance, or None if none found
    """
    # Priority order: try dine-in first, then regular PetPooja
    pos_systems_to_try = ["petpooja_dinein", "petpooja"]
    
    for pos_system_name in pos_systems_to_try:
        integration = get_pos_integration_by_name(restaurant_id, pos_system_name, db)
        if integration:
            return integration
    
    return None