from abc import ABC, abstractmethod
from typing import Dict, List
from models.schema import POSSystem, Order, CartItem


class POSInterface(ABC):
    """Abstract base class for POS system integrations"""
    
    def __init__(self, pos_system: POSSystem):
        self.pos_system = pos_system
        self.config = pos_system.config
    
    @abstractmethod
    def fetch_menu(self) -> Dict:
        """Fetch menu from POS system
        
        Returns:
            Dict: Raw menu data from POS system
        """
        pass
    
    @abstractmethod
    def sync_menu_to_internal(self, pos_menu: Dict) -> None:
        """Transform and sync POS menu to internal structure
        
        Args:
            pos_menu (Dict): Raw menu data from POS system
        """
        pass
    
    @abstractmethod
    def place_order(self, internal_order: Order) -> Dict:
        """Place order in POS system
        
        Args:
            internal_order (Order): Internal order object
            
        Returns:
            Dict: Response from POS system
        """
        pass
    
    @abstractmethod
    def transform_cart_for_pos(self, cart_items: List[CartItem]) -> Dict:
        """Transform internal cart to POS-specific format
        
        Args:
            cart_items (List[CartItem]): Internal cart items with variations/addons
            
        Returns:
            Dict: POS-formatted order data
        """
        pass 