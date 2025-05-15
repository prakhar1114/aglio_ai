from pathlib import Path
import redis
import qdrant_client
import os, ast
from dotenv import load_dotenv

load_dotenv()

DEBUG_MODE = ast.literal_eval(os.getenv("DEBUG_MODE", "False"))

root_dir = Path(__file__).parent

rdb   = redis.Redis(host="localhost", port=6379, decode_responses=False)
qd    = qdrant_client.QdrantClient("localhost", port=6333)
restaurant_name = "chianti"
qd_collection_name = f"{restaurant_name}_dishes"