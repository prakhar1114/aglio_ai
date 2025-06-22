import json
from typing import Dict, List
from fastapi import WebSocket
from loguru import logger

class ConnectionManager:
    """Manages WebSocket connections for table sessions"""
    
    def __init__(self):
        # session_pid -> list of WebSocket connections
        self.connections: Dict[str, List[WebSocket]] = {}
        # websocket -> session_pid mapping for cleanup
        self.websocket_sessions: Dict[WebSocket, str] = {}
        
    async def connect(self, websocket: WebSocket, session_pid: str) -> bool:
        """
        Add a WebSocket connection to a session
        
        Args:
            websocket: WebSocket connection
            session_pid: Session public ID
            
        Returns:
            True if connection added, False if session is at capacity
        """
        await websocket.accept()
        
        # Initialize session connections list if needed
        if session_pid not in self.connections:
            self.connections[session_pid] = []
            
        # Check connection limit (max 20 per session)
        if len(self.connections[session_pid]) >= 20:
            await websocket.close(code=4008, reason="Connection limit exceeded")
            return False
            
        # Add connection
        self.connections[session_pid].append(websocket)
        self.websocket_sessions[websocket] = session_pid
        
        logger.info(f"WebSocket connected to session {session_pid}. Total connections: {len(self.connections[session_pid])}")
        return True
        
    def disconnect(self, websocket: WebSocket):
        """
        Remove a WebSocket connection
        
        Args:
            websocket: WebSocket connection to remove
        """
        session_pid = self.websocket_sessions.get(websocket)
        if not session_pid:
            return
            
        # Remove from connections
        if session_pid in self.connections:
            try:
                self.connections[session_pid].remove(websocket)
                if not self.connections[session_pid]:  # Remove empty session
                    del self.connections[session_pid]
            except ValueError:
                pass  # Connection already removed
                
        # Remove from websocket mapping
        if websocket in self.websocket_sessions:
            del self.websocket_sessions[websocket]
            
        logger.info(f"WebSocket disconnected from session {session_pid}")
        
    async def broadcast_to_session(self, session_pid: str, message: dict):
        """
        Broadcast a message to all connections in a session
        
        Args:
            session_pid: Session public ID
            message: Message dict to broadcast
        """
        if session_pid not in self.connections:
            return
            
        # Create list copy to avoid modification during iteration
        connections = self.connections[session_pid].copy()
        
        for websocket in connections:
            try:
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Failed to send message to WebSocket in session {session_pid}: {e}")
                # Remove broken connection
                self.disconnect(websocket)
                
    async def send_error(self, websocket: WebSocket, code: str, detail: str):
        """
        Send error message to a specific WebSocket
        
        Args:
            websocket: WebSocket connection
            code: Error code
            detail: Error detail message
        """
        try:
            error_message = {
                "type": "error",
                "code": code,
                "detail": detail
            }
            await websocket.send_text(json.dumps(error_message))
        except Exception as e:
            logger.warning(f"Failed to send error message: {e}")
            
    def get_session_connection_count(self, session_pid: str) -> int:
        """Get number of active connections for a session"""
        return len(self.connections.get(session_pid, []))
        
    def get_total_connections(self) -> int:
        """Get total number of active connections across all sessions"""
        return sum(len(conns) for conns in self.connections.values())

# Global connection manager instance
connection_manager = ConnectionManager() 