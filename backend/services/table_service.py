from datetime import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models.schema import Restaurant, Table, Session as TableSession


class TableInfo:
    """Table information for API responses"""
    def __init__(self, table: Table, session: Optional[TableSession] = None):
        self.id = table.id
        self.number = table.number
        # Determine effective status: if there's an active session, show as occupied
        if session and session.state == "active":
            self.status = "occupied"
        else:
            self.status = table.status
        self.session = None
        
        if session:
            self.session = {
                "id": session.id,
                "last_active": session.last_activity_at.isoformat() + "Z"
            }
    
    @classmethod
    def from_table(cls, table: Table, db):
        """Create TableInfo from a table, fetching active session if any"""
        active_session = db.query(TableSession).filter(
            TableSession.table_id == table.id,
            TableSession.state == "active"
        ).first()
        return cls(table, active_session)
    
    def to_dict(self):
        return {
            "id": self.id,
            "number": self.number,
            "status": self.status,
            "session": self.session
        }


async def get_all_tables(db: Session, restaurant: Restaurant) -> list[TableInfo]:
    """Get all tables with their active sessions for a restaurant"""
    tables = db.query(Table).filter(Table.restaurant_id == restaurant.id).all()
    
    result = []
    for table in tables:
        # Find active session for this table
        active_session = db.query(TableSession).filter(
            TableSession.table_id == table.id,
            TableSession.state == "active"
        ).first()
        
        table_info = TableInfo(table, active_session)
        result.append(table_info)
    
    return result


async def close_table_service(db: Session, restaurant: Restaurant, table_id: int) -> Tuple[bool, Optional[TableInfo], Optional[str]]:
    """Close active session and mark table dirty"""
    # Get table
    table = db.query(Table).filter(
        Table.id == table_id,
        Table.restaurant_id == restaurant.id
    ).first()
    
    if not table:
        return False, None, "table_not_found"
    
    # Find active session
    active_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.state == "active"
    ).first()
    
    if not active_session:
        return False, None, "no_active_session"
    
    # Close session and mark table open
    active_session.state = "closed"
    table.status = "open"
    
    db.commit()
    
    return True, TableInfo(table), None


async def disable_table_service(db: Session, restaurant: Restaurant, table_id: int) -> Tuple[bool, Optional[TableInfo], Optional[str]]:
    """Disable table (only when free)"""
    # Get table
    table = db.query(Table).filter(
        Table.id == table_id,
        Table.restaurant_id == restaurant.id
    ).first()
    
    if not table:
        return False, None, "table_not_found"
    
    if table.status == "disabled":
        return False, None, "already_disabled"
    
    # Check for active session
    active_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.state == "active"
    ).first()
    
    if active_session:
        return False, None, "table_occupied"
    
    # Disable table
    table.status = "disabled"
    db.commit()
    
    return True, TableInfo(table), None


async def enable_table_service(db: Session, restaurant: Restaurant, table_id: int) -> Tuple[bool, Optional[TableInfo], Optional[str]]:
    """Re-open a disabled table or clean a dirty table"""
    # Get table
    table = db.query(Table).filter(
        Table.id == table_id,
        Table.restaurant_id == restaurant.id
    ).first()
    
    if not table:
        return False, None, "table_not_found"
    
    if table.status not in ["disabled", "dirty"]:
        return False, None, "not_disabled"
    
    # Check for active session (shouldn't happen but validate)
    active_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.state == "active"
    ).first()
    
    if active_session:
        return False, None, "table_occupied"
    
    # Enable table or clean dirty table
    table.status = "open"
    db.commit()
    
    return True, TableInfo(table), None


async def restore_table_service(db: Session, restaurant: Restaurant, table_id: int) -> Tuple[bool, Optional[TableInfo], Optional[str]]:
    """Reopen the most recent closed/expired session"""
    # Get table
    table = db.query(Table).filter(
        Table.id == table_id,
        Table.restaurant_id == restaurant.id
    ).first()
    
    if not table:
        return False, None, "table_not_found"
    
    # Check for existing active session
    active_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.state == "active"
    ).first()
    
    if active_session:
        return False, None, "table_occupied"
    
    # Find most recent closed/expired session
    last_session = db.query(TableSession).filter(
        TableSession.table_id == table_id,
        TableSession.state.in_(["closed", "expired"])
    ).order_by(desc(TableSession.last_activity_at)).first()
    
    if not last_session:
        return False, None, "no_session_to_restore"
    
    # Restore session
    last_session.state = "active"
    last_session.last_activity_at = datetime.utcnow()
    
    db.commit()
    
    return True, TableInfo(table, last_session), None


async def move_table_service(db: Session, restaurant: Restaurant, from_table_id: int, to_table_id: int) -> Tuple[bool, Optional[list[TableInfo]], Optional[str]]:
    """Move current party to another empty table"""
    if from_table_id == to_table_id:
        return False, None, "same_table"
    
    # Get source table
    source_table = db.query(Table).filter(
        Table.id == from_table_id,
        Table.restaurant_id == restaurant.id
    ).first()
    
    if not source_table:
        return False, None, "source_table_not_found"
    
    # Get target table
    target_table = db.query(Table).filter(
        Table.id == to_table_id,
        Table.restaurant_id == restaurant.id
    ).first()
    
    if not target_table:
        return False, None, "target_table_not_found"
    
    # Check target table availability
    if target_table.status != "open":
        return False, None, "target_unavailable"
    
    # Check for active session on target table
    target_active_session = db.query(TableSession).filter(
        TableSession.table_id == to_table_id,
        TableSession.state == "active"
    ).first()
    
    if target_active_session:
        return False, None, "target_unavailable"
    
    # Check for active session on source table
    source_active_session = db.query(TableSession).filter(
        TableSession.table_id == from_table_id,
        TableSession.state == "active"
    ).first()
    
    if not source_active_session:
        return False, None, "no_session_to_move"
    
    # Move the session
    source_active_session.table_id = to_table_id
    source_active_session.last_activity_at = datetime.utcnow()
    
    db.commit()
    
    # Return both affected tables
    updated_tables = [
        TableInfo(source_table),  # Now empty
        TableInfo(target_table, source_active_session)  # Now occupied
    ]
    
    return True, updated_tables, None 