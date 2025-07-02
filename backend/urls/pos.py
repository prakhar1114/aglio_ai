import logging
from typing import Dict
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from models.schema import SessionLocal, get_db
from services.pos.utils import get_pos_integration_by_name


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/pos/{pos_system_name}/sync-menu")
async def sync_menu_from_pos(
    pos_system_name: str,
    restaurant_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Trigger menu sync from POS system
    
    Args:
        pos_system_name (str): Name of the POS system (e.g., "petpooja")
        restaurant_id (int): Restaurant ID
        background_tasks: FastAPI background tasks
        db: Database session
        
    Returns:
        dict: Status response
    """
    try:
        pos_integration = get_pos_integration_by_name(restaurant_id, pos_system_name, db)
        
        # Run sync in background
        background_tasks.add_task(
            _sync_menu_task,
            pos_integration,
            db
        )
        
        logger.info(f"Started menu sync for restaurant {restaurant_id} with POS {pos_system_name}")
        return {"status": "sync_started", "message": f"Menu sync started for {pos_system_name}"}
        
    except ValueError as e:
        logger.error(f"POS sync error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during POS sync: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during sync")


@router.post("/pos/{pos_system_name}/manual-sync")
async def manual_menu_sync(
    pos_system_name: str,
    restaurant_id: int,
    menu_data: Dict,
    db: Session = Depends(get_db)
):
    """Manual menu data upload for POS integration
    
    Args:
        pos_system_name (str): Name of the POS system
        restaurant_id (int): Restaurant ID
        menu_data (Dict): Menu data in POS format
        db: Database session
        
    Returns:
        dict: Status response
    """
    try:
        pos_integration = get_pos_integration_by_name(restaurant_id, pos_system_name, db)
        
        # Sync menu data directly
        pos_integration.sync_menu_to_internal(menu_data, db)
        
        logger.info(f"Completed manual menu sync for restaurant {restaurant_id} with POS {pos_system_name}")
        return {"status": "sync_completed", "message": f"Menu data synchronized for {pos_system_name}"}
        
    except ValueError as e:
        logger.error(f"Manual POS sync error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during manual POS sync: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during manual sync")


@router.get("/pos/{pos_system_name}/status")
async def get_pos_status(
    pos_system_name: str,
    restaurant_id: int,
    db: Session = Depends(get_db)
):
    """Get POS integration status and configuration
    
    Args:
        pos_system_name (str): Name of the POS system
        restaurant_id (int): Restaurant ID
        db: Database session
        
    Returns:
        dict: POS status information
    """
    try:
        pos_integration = get_pos_integration_by_name(restaurant_id, pos_system_name, db)
        pos_system = pos_integration.pos_system
        
        return {
            "pos_system": pos_system.name,
            "restaurant_id": pos_system.restaurant_id,
            "is_active": pos_system.is_active,
            "last_updated": pos_system.updated_at.isoformat() if pos_system.updated_at else None,
            "config_keys": list(pos_system.config.keys()) if pos_system.config else []
        }
        
    except ValueError as e:
        logger.error(f"POS status error: {e}")
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error getting POS status: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


async def _sync_menu_task(pos_integration, db: Session):
    """Background task to sync menu from POS system
    
    Args:
        pos_integration: POS integration instance
        db: Database session
    """
    try:
        # Fetch menu from POS
        pos_menu = pos_integration.fetch_menu()
        
        # Sync to internal structure
        pos_integration.sync_menu_to_internal(pos_menu, db)
        
        logger.info(f"Successfully completed menu sync for POS {pos_integration.pos_system.name}")
        
    except Exception as e:
        logger.error(f"Background menu sync failed: {e}")
        # In a production system, you might want to:
        # - Store the error in the database
        # - Send notifications to admins
        # - Retry with exponential backoff 