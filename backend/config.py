from pathlib import Path
import redis
import qdrant_client
import os, ast
from dotenv import load_dotenv

load_dotenv()

DEBUG_MODE = ast.literal_eval(os.getenv("DEBUG_MODE", "False"))

root_dir = Path(__file__).parent

# Database connections (shared across all tenants)
rdb = redis.Redis(host="localhost", port=6379, decode_responses=False)
qd = qdrant_client.QdrantClient("localhost", port=6333)

# Multi-tenant Redis key generators
def get_tenant_redis_key(tenant_id: str, key_type: str, identifier: str = "") -> str:
    """Generate tenant-scoped Redis keys"""
    if identifier:
        return f"{tenant_id}:{key_type}:{identifier}"
    return f"{tenant_id}:{key_type}"

# Helper functions for tenant-aware Redis operations
def get_tenant_vec_key(tenant_id: str, session_id: str) -> str:
    return get_tenant_redis_key(tenant_id, "vec", session_id)

def get_tenant_stat_key(tenant_id: str, dish_id: int) -> str:
    return get_tenant_redis_key(tenant_id, "stat", str(dish_id))

def get_tenant_seen_key(tenant_id: str, session_id: str) -> str:
    return get_tenant_redis_key(tenant_id, "seen", session_id)

def get_tenant_history_key(tenant_id: str, session_id: str, action: str) -> str:
    return get_tenant_redis_key(tenant_id, f"history:{session_id}", action)