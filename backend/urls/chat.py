from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger
import json
from recommender.ai import generate_blocks
from common.utils import enrich_blocks
from middleware.tenant_resolver import tenant_resolver
from config import DEBUG_MODE

router = APIRouter()

@router.websocket("/chat")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint that accepts sessionId query param and resolves tenant
    from the Host header for multi-tenant support.
    """
    session_id = websocket.query_params.get("sessionId")
    name = websocket.query_params.get("username", None)
    
    # Extract tenant from WebSocket headers (similar to middleware)
    host = websocket.headers.get("host", "")
    tenant_id = tenant_resolver.extract_tenant_from_host(host, DEBUG_MODE)
    
    if not tenant_id:
        logger.warning(f"No tenant found for WebSocket host: {host}")
        await websocket.close(code=4000, reason="Invalid subdomain")
        return
    
    # Validate tenant exists and is configured
    if not tenant_resolver.validate_tenant(tenant_id):
        logger.warning(f"Tenant not found or not configured for WebSocket: {tenant_id}")
        await websocket.close(code=4004, reason="Restaurant not found")
        return
    
    # Get tenant info and collection name
    tenant_info = tenant_resolver.get_tenant_info(tenant_id)
    collection_name = tenant_info["qdrant_db_name"]
    restaurant_name = tenant_info["restaurant_name"]
    
    logger.info(f"WebSocket connection opened for session: {session_id}, tenant: {tenant_id} ({restaurant_name})")
    await websocket.accept()
    
    # Send personalized welcome message with restaurant name
    if name:
        await websocket.send_json({
            "blocks": [{
                "type": "text", 
                "markdown": f"👋 Welcome **{name}** to **{restaurant_name}**! How can I help you today?"
            }]
        })
    else:
        await websocket.send_json({
            "blocks": [{
                "type": "text", 
                "markdown": f"👋 Welcome to **{restaurant_name}**! How can I help you today?"
            }]
        })

    await websocket.send_json({
        "blocks": [
            # {
            #     "type": "text",
            #     "markdown": "Here are two dishes you might like:"
            # },
            # {
            #     "type": "dish_card",
            #     "payload": {
            #         "id": "dish-91",
            #         "name": "Fusilli Pesto",
            #         "image": "https://cdn.aglio.app/fusilli.jpg",
            #         "price": 595,
            #         "tags": ["vegetarian", "basil"]
            #     }
            # },
            {
                "type": "quick_replies",
                "options": [
                    "Chef Specials",
                    "Best Sellers",
                    "What is Fettucine Pasta?"
                ]
            }
        ]
    })

    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            
            try:
                # Try to parse as JSON
                payload = json.loads(data)
            except json.JSONDecodeError:
                logger.warning(f"Received non-JSON data: {data}")
                continue
            
            session_id = payload.pop("sessionId", session_id)
            thread_id = payload.pop("threadId", None)
            
            # Generate blocks with tenant-aware collection name
            blocks = generate_blocks(payload, thread_id, collection_name)
            enriched_blocks = enrich_blocks(blocks, collection_name)
            
            # Send response back to client
            response = enriched_blocks

            await websocket.send_json(response)
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session: {session_id}, tenant: {tenant_id}")
