from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from loguru import logger
import asyncio
import json
from recommender.ai import generate_blocks
from config import qd, qd_collection_name
from recommender import Blocks

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

def enrich_blocks(blocks: Blocks) -> dict:
    blocks = blocks.model_dump()
    for block in blocks["blocks"]:
        if block["type"] == "dish_carousal":
            for option in block["options"]:
                ## fetch dish from Qdrant
                dish = qd.retrieve(qd_collection_name, ids=[option["id"]], with_payload=True, with_vectors=False)[0]
                option["image_url"] = dish.payload["image_path"]
                option["name"] = dish.payload["name"]
                option["price"] = dish.payload["price"]
                option["description"] = dish.payload["description"]
        
        if block["type"] == "dish_card":
            dish = qd.retrieve(qd_collection_name, ids=[block["id"]], with_payload=True, with_vectors=False)[0]
            block["image_url"] = dish.payload["image_path"]
            block["name"] = dish.payload["name"]
            block["price"] = dish.payload["price"]
            block["description"] = dish.payload["description"]

    return blocks