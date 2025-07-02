from typing import Dict, Type
from sqlalchemy.orm import Session

from .interface import POSInterface
from .petpooja import PetPoojaIntegration
from models.schema import POSSystem


# Registry of available POS integrations
POS_INTEGRATIONS: Dict[str, Type[POSInterface]] = {
    "petpooja": PetPoojaIntegration,
    # Add more POS systems here in the future
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
    
    if not pos_system:
        raise ValueError(f"No active POS system '{pos_system_name}' found for restaurant {restaurant_id}")
    
    return pos_system


def get_pos_integration(pos_system: POSSystem) -> POSInterface:
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


def get_pos_integration_by_name(restaurant_id: int, pos_system_name: str, db: Session) -> POSInterface:
    """Get POS integration instance by restaurant ID and POS system name
    
    Args:
        restaurant_id (int): Restaurant ID
        pos_system_name (str): Name of the POS system
        db (Session): Database session
        
    Returns:
        POSInterface: POS integration instance
    """
    pos_system = get_pos_system(restaurant_id, pos_system_name, db)
    return get_pos_integration(pos_system) 