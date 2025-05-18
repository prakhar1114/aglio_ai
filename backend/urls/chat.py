from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger
import json
from recommender.ai import generate_blocks
from common.utils import enrich_blocks

router = APIRouter()

@router.websocket("/chat")
async def websocket_endpoint(websocket: WebSocket):
    """
    Barebones WebSocket endpoint that accepts a sessionId query param
    and confirms the connection.
    """
    session_id = websocket.query_params.get("sessionId")
    name = websocket.query_params.get("username", None)
    logger.info(f"WebSocket connection opened for session: {session_id}")
    await websocket.accept()
    if name:
        await websocket.send_json({"blocks": [{"type": "text", "markdown": f"👋 Welcome **{name}**! How can I help you today?"}]})
    else:
        await websocket.send_json({"blocks": [{"type": "text", "markdown": "👋 Welcome to **Chianti**! How can I help you today?"}]})

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
            
            session_id = payload.pop("sessionId")
            thread_id = payload.pop("threadId")
            blocks = generate_blocks(payload, thread_id)
            enriched_blocks = enrich_blocks(blocks)
            
            # Send response back to client
            response = enriched_blocks

            await websocket.send_json(response)
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for session: {session_id}")
