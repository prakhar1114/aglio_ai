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
    action: str        # "like" | "order" | "dislike"

# -------- utility -------------------------------------------------------
def vec_key(sess): return f"vec:{sess}"
def stat_key(d):    return f"stat:{d}"

def get_user_vec(sess_id):
    raw = rdb.get(vec_key(sess_id))
    return np.frombuffer(raw, dtype=np.float32) if raw else np.zeros(DIM)

def set_user_vec(sess_id, vec):
    rdb.set(vec_key(sess_id), vec.astype(np.float32).tobytes())

def update_user_vec(vec, dish_vec, action):
    if action=="order":  w=2.0
    elif action=="like": w=0.5
    else:                w=-0.3
    new_vec = vec + w* dish_vec
    return new_vec / (np.linalg.norm(new_vec)+1e-8)

# -------- endpoints -----------------------------------------------------
@app.get("/recommend")
def recommend(session_id: str, veg: int|None=None, price_cap: int|None=None):
    user_vec = get_user_vec(session_id)
    filt = []
    if veg is not None:
        filt.append({"key": "veg_flag", "match": {"value": veg}})
    if price_cap:
        filt.append({"key": "price", "match": {"lte": price_cap}})
    res = qd.search(qd_collection_name, user_vec.tolist(), query_filter={"must":filt} if filt else None, limit=10)
    cand_ids = [hit.id for hit in res]

    # ε-greedy
    if random.random() < EPS:     dish_id = random.choice(cand_ids)
    else:
        def ctr(d):
            s,r = rdb.hget(stat_key(d),"reward") or 0, rdb.hget(stat_key(d),"impr") or 1
            return float(s)/float(r)
        dish_id = max(cand_ids, key=ctr)

    payload = qd.retrieve(qd_collection_name, ids=[dish_id])[0].payload
    return {"id": dish_id, **payload}

@app.post("/feedback")
def feedback(fb: Feedback):
    dish = qd.retrieve(
        qd_collection_name,
        ids=[fb.id],
        # with_payload=True,
        with_vectors=True
    )[0]
    vec  = np.array(dish.vector)

    # --- bandit update
    r  = 1.0 if fb.action=="order" else 0.4 if fb.action=="like" else 0.0
    pipe = rdb.pipeline()
    pipe.hincrbyfloat(stat_key(fb.id),"reward", r)
    pipe.hincrby(stat_key(fb.id),"impr", 1)
    pipe.execute()

    # --- preference vector update
    uvec = get_user_vec(fb.session_id)
    uvec = update_user_vec(uvec, vec, fb.action)
    set_user_vec(fb.session_id, uvec)
    return {"ok": True}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8005)
