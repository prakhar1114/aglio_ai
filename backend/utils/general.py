import uuid

def new_id() -> str:
    """Generate 6‑char public_id."""
    return uuid.uuid4().hex[:6]