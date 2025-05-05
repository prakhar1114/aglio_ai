from pathlib import Path
import redis
import qdrant_client

root_dir = Path(__file__).parent

rdb   = redis.Redis(host="localhost", port=6379, decode_responses=False)
qd    = qdrant_client.QdrantClient("localhost", port=6333)
restaurant_name = "chianti"
qd_collection_name = f"{restaurant_name}_dishes"