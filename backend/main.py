from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import numpy as np, redis, qdrant_client, random
import uvicorn

app = FastAPI()

app.mount(
    "/image_data",
    StaticFiles(directory="raw_data"),
    name="image_data",
)

rdb   = redis.Redis(host="localhost", port=6379, decode_responses=False)
qd    = qdrant_client.QdrantClient("localhost", port=6333)
restaurant_name = "chianti"
qd_collection_name = f"{restaurant_name}_dishes"

DIM = 1280
EPS  = 0.1     # ε-greedy rate

class Feedback(BaseModel):
    session_id: str
    id: int
    action: str        # "maybe" | "skip"

# -------- utility -------------------------------------------------------
def vec_key(sess): return f"vec:{sess}"
def stat_key(d):    return f"stat:{d}"
def seen_key(sess): return f"seen:{sess}"

def get_user_vec(sess_id):
    raw = rdb.get(vec_key(sess_id))
    if raw:
        return np.frombuffer(raw, dtype=np.float32)
    else:
        # cold-start tiny random vector
        return np.random.normal(0, 0.01, DIM).astype(np.float32)

def set_user_vec(sess_id, vec):
    rdb.set(vec_key(sess_id), vec.astype(np.float32).tobytes())

def update_user_vec(vec, dish_vec, action):
    if action=="maybe":  w=0.5
    else:                w=-0.3
    new_vec = vec + w* dish_vec
    return new_vec / (np.linalg.norm(new_vec)+1e-8)

# -------- endpoints -----------------------------------------------------
@app.get("/recommend")
def recommend(session_id: str, is_veg: bool|None=None, price_cap: int|None=None):
    user_vec = get_user_vec(session_id)
    filt = []
    if is_veg is not None:
        filt.append({"key": "veg_flag", "match": {"value": 1 if is_veg else 0}})
    if price_cap is not None:
        # use RangeCondition for numeric filtering
        filt.append({"key": "price", "range": {"lte": price_cap}})
    res = qd.search(qd_collection_name, user_vec.tolist(), query_filter={"must":filt} if filt else None, limit=10)
    cand_ids = [hit.id for hit in res]

    # seen-item filter: drop items already shown and reset when exhausted
    seen = rdb.smembers(seen_key(session_id))
    used = {int(x.decode()) for x in seen} if seen else set()
    remaining = [d for d in cand_ids if d not in used]
    if not remaining:
        rdb.delete(seen_key(session_id))
        remaining = cand_ids
    cand_ids = remaining

    # Thompson sampling for best candidate
    samples = []
    for d in cand_ids:
        s = float(rdb.hget(stat_key(d), "reward") or 0)
        r = float(rdb.hget(stat_key(d), "impr") or 0)
        # Beta prior: add 1 to each count for smoothing
        sample = np.random.beta(s + 1, r - s + 1 if r - s > 0 else 1)
        samples.append((sample, d))
    dish_id = max(samples)[1]

    # record this recommendation
    rdb.sadd(seen_key(session_id), dish_id)

    payload = qd.retrieve(qd_collection_name, ids=[dish_id])[0].payload
    return {"id": dish_id, **payload}

@app.post("/feedback")
def feedback(fb: Feedback):
    dish = qd.retrieve(
        qd_collection_name,
        ids=[fb.id],
        with_vectors=True
    )[0]
    vec  = np.array(dish.vector)

    # --- bandit update
    r  = 0.4 if fb.action=="maybe" else 0.0
    pipe = rdb.pipeline()
    pipe.hincrbyfloat(stat_key(fb.id),"reward", r)
    pipe.hincrby(stat_key(fb.id),"impr", 1)
    pipe.execute()

    # --- preference vector update
    uvec = get_user_vec(fb.session_id)
    uvec = update_user_vec(uvec, vec, fb.action)
    set_user_vec(fb.session_id, uvec)
    # record feedback history per session and action
    rdb.rpush(f"history:{fb.session_id}:{fb.action}", fb.id)
    return {"ok": True}

@app.get("/history")
def history(session_id: str):
    def fetch(action: str):
        key = f"history:{session_id}:{action}"
        ids = [int(x) for x in rdb.lrange(key, 0, -1)]
        if not ids:
            return []
        recs = qd.retrieve(qd_collection_name, ids=ids)
        return [{"id": r.id, **r.payload} for r in recs]
    return {
        "maybe": fetch("maybe"),
        "skip":  fetch("skip"),
    }

if __name__ == "__main__":
    # Use import string for reload to work
    uvicorn.run("main:app", host="0.0.0.0", port=8005, reload=True)
