from pathlib import Path
import redis
import qdrant_client
import os, ast
from dotenv import load_dotenv
from loguru import logger
import sys

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL")
FRONTEND_URL = os.getenv("FRONTEND_URL")
DEBUG_MODE = ast.literal_eval(os.getenv("DEBUG_MODE", "False"))

logger.remove()
logger.add(sys.stderr, level="DEBUG" if DEBUG_MODE else "INFO")

JWT_SECRET=os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("JWT_SECRET is not set in environment variables")

PG_DB_USER = os.getenv("PG_DB_USER", "postgres")
PG_DB_PASS = os.getenv("PG_DB_PASS", "postgres")
PG_DB_HOST = os.getenv("PG_DB_HOST", "localhost")
PG_DB_PORT = os.getenv("PG_DB_PORT", "5432")
PG_DB_NAME = os.getenv("PG_DB_NAME", "db")

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY")
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY")

root_dir = Path(__file__).parent

# Database connections (shared across all tenants)
rdb = redis.Redis(host="localhost", port=6379, decode_responses=False)
qd = qdrant_client.QdrantClient("localhost", port=6333)
pg_url = f"postgresql://{PG_DB_USER}:{PG_DB_PASS}@{PG_DB_HOST}:{PG_DB_PORT}/{PG_DB_NAME}"

image_dir = Path(os.getenv("IMAGE_DIR", "images"))

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

# Table session Redis keys
def get_table_session_key(tenant_id: str, table_number: int) -> str:
    return get_tenant_redis_key(tenant_id, "table_session", str(table_number))

def get_session_details_key(tenant_id: str, session_id: str) -> str:
    return get_tenant_redis_key(tenant_id, "session", session_id)

def get_table_sessions_key(tenant_id: str, table_number: int) -> str:
    """Return key for sorted-set that stores all session IDs ever used by a table"""
    return get_tenant_redis_key(tenant_id, "table_sessions", str(table_number))