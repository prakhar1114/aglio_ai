from recommender import Blocks
from config import qd

def enrich_blocks(blocks: Blocks, collection_name: str) -> dict:
    """
    Enrich blocks with additional data from Qdrant.
    
    Args:
        blocks: The blocks object to enrich
        collection_name: The Qdrant collection name to use (tenant-specific)
        
    Returns:
        dict: The enriched blocks as a dictionary
    """
    blocks = blocks.model_dump() if not isinstance(blocks, dict) else blocks
    
    for block in blocks["blocks"]:
        if block["type"] == "dish_carousal":
            for option in block["options"]:
                ## fetch dish from Qdrant
                dish = qd.retrieve(collection_name, ids=[option["id"]], with_payload=True, with_vectors=False)[0]
                option["image_url"] = dish.payload.get("image_path")
                option["name"] = dish.payload.get("name")
                option["price"] = dish.payload.get("price")
                option["description"] = dish.payload.get("description")
        
        if block["type"] == "dish_card":
            dish = qd.retrieve(collection_name, ids=[block["id"]], with_payload=True, with_vectors=False)[0]
            block["image_url"] = dish.payload.get("image_path")
            block["name"] = dish.payload.get("name")
            block["price"] = dish.payload.get("price")
            block["description"] = dish.payload.get("description")

    return blocks
