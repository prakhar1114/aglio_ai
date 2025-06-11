DIM = 1280
EPS = 0.1     # ε-greedy rate

class Feedback(BaseModel):
    session_id: str
    id: int
    action: str        # "maybe" | "skip"

# -------- utility functions (now tenant-aware) -----------------------------
def vec_key(tenant_id: str, sess: str) -> str:
    return f"{tenant_id}:vec:{sess}"

def stat_key(tenant_id: str, d: int) -> str:
    return f"{tenant_id}:stat:{d}"

def seen_key(tenant_id: str, sess: str) -> str:
    return f"{tenant_id}:seen:{sess}"

def get_user_vec(tenant_id: str, sess_id: str):
    raw = rdb.get(vec_key(tenant_id, sess_id))
    if raw:
        return np.frombuffer(raw, dtype=np.float32)
    else:
        # cold-start tiny random vector
        return np.random.normal(0, 0.01, DIM).astype(np.float32)

def set_user_vec(tenant_id: str, sess_id: str, vec):
    rdb.set(vec_key(tenant_id, sess_id), vec.astype(np.float32).tobytes())

def update_user_vec(vec, dish_vec, action):
    if action=="maybe":  w=0.5
    else:                w=-0.3
    new_vec = vec + w* dish_vec
    return new_vec / (np.linalg.norm(new_vec)+1e-8)

# -------- endpoints (updated for multi-tenant) -----------------------------
@app.get("/recommend")
def recommend(request: Request, session_id: str, is_veg: bool|None=None, price_cap: int|None=None):
    # Get tenant-specific collection
    collection_name = get_qdrant_collection(request)
    tenant_id = request.state.tenant_id
    
    user_vec = get_user_vec(tenant_id, session_id)
    filt = []
    if is_veg is not None:
        filt.append({"key": "veg_flag", "match": {"value": 1 if is_veg else 0}})
    if price_cap is not None:
        # use RangeCondition for numeric filtering
        filt.append({"key": "price", "range": {"lte": price_cap}})
    
    res = qd.search(collection_name, user_vec.tolist(), query_filter={"must":filt} if filt else None, limit=10)
    cand_ids = [hit.id for hit in res]

    # seen-item filter: drop items already shown and reset when exhausted
    seen = rdb.smembers(seen_key(tenant_id, session_id))
    used = {int(x.decode()) for x in seen} if seen else set()
    remaining = [d for d in cand_ids if d not in used]
    if not remaining:
        rdb.delete(seen_key(tenant_id, session_id))
        remaining = cand_ids
    cand_ids = remaining

    # Thompson sampling for best candidate
    samples = []
    for d in cand_ids:
        s = float(rdb.hget(stat_key(tenant_id, d), "reward") or 0)
        r = float(rdb.hget(stat_key(tenant_id, d), "impr") or 0)
        # Beta prior: add 1 to each count for smoothing
        sample = np.random.beta(s + 1, r - s + 1 if r - s > 0 else 1)
        samples.append((sample, d))
    dish_id = max(samples)[1]

    # record this recommendation
    rdb.sadd(seen_key(tenant_id, session_id), dish_id)

    payload = qd.retrieve(collection_name, ids=[dish_id])[0].payload
    return {"id": dish_id, **payload}

@app.post("/feedback")
def feedback(request: Request, fb: Feedback):
    collection_name = get_qdrant_collection(request)
    tenant_id = request.state.tenant_id
    
    dish = qd.retrieve(
        collection_name,
        ids=[fb.id],
        with_vectors=True
    )[0]
    vec = np.array(dish.vector)

    # --- bandit update
    r = 0.4 if fb.action=="maybe" else 0.0
    pipe = rdb.pipeline()
    pipe.hincrbyfloat(stat_key(tenant_id, fb.id),"reward", r)
    pipe.hincrby(stat_key(tenant_id, fb.id),"impr", 1)
    pipe.execute()

    # --- preference vector update
    uvec = get_user_vec(tenant_id, fb.session_id)
    uvec = update_user_vec(uvec, vec, fb.action)
    set_user_vec(tenant_id, fb.session_id, uvec)
    # record feedback history per session and action
    rdb.rpush(f"{tenant_id}:history:{fb.session_id}:{fb.action}", fb.id)
    return {"ok": True}

@app.get("/history")
def history(request: Request, session_id: str):
    collection_name = get_qdrant_collection(request)
    tenant_id = request.state.tenant_id
    
    def fetch(action: str):
        key = f"{tenant_id}:history:{session_id}:{action}"
        ids = [int(x) for x in rdb.lrange(key, 0, -1)]
        if not ids:
            return []
        recs = qd.retrieve(collection_name, ids=ids)
        return [{"id": r.id, **r.payload} for r in recs]
    return {
        "maybe": fetch("maybe"),
        "skip":  fetch("skip"),
    }