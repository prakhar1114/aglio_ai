Chinu-Phone  – session host  
Anshu-Phone  – ordinary member  
FastAPI      – REST layer  
WS-Hub       – WebSocket broadcast hub  
DB           – Postgres

sequenceDiagram
    autonumber
    %% ───────────────── 0  Page load / hydration ─────────────────
    Note over Chinu-Phone,Anshu-Phone: both phones have session_pid & ws_token cached
    Chinu-Phone->>FastAPI: GET /cart_snapshot?session_pid=S
    FastAPI-->>Chinu-Phone: {"items":[],"members":[],"orders":[],"cart_version":0}
    Anshu-Phone->>FastAPI: GET /cart_snapshot?session_pid=S
    FastAPI-->>Anshu-Phone: same empty payload

    Chinu-Phone->>WS-Hub: WS connect (sid=S, Bearer token)
    Anshu-Phone->>WS-Hub: WS connect (sid=S, Bearer token)

    %% ───────────────── 1  Host adds first item ─────────────────
    Note over Chinu-Phone: tmp row c1, version 0 (grey)
    Chinu-Phone->>WS-Hub: cart_mutate{op:create,tmpId:c1,menu_item:17,qty:1}
    WS-Hub->>FastAPI: validate (pass NOT validated yet)
    FastAPI-->>Chinu-Phone: error{code:pass_required}

    %% ─── 1A  Password prompt and validation
    Note right of Chinu-Phone: modal ⇒ enter "coffee"
    Chinu-Phone->>FastAPI: POST /session/validate_pass{session_pid:S,word:"coffee"}
    FastAPI->>DB: compare SHA
    DB-->>FastAPI: ok
    FastAPI-->>Chinu-Phone: 200 success
    Note right of Chinu-Phone: client replays original create

    %% Host re-sends create (now allowed)
    Chinu-Phone->>WS-Hub: cart_mutate{op:create,tmpId:c1,menu_item:17,qty:1}
    WS-Hub->>FastAPI: host OK, pass_validated=true
    FastAPI->>DB: INSERT cart_items(id=100,version=1,member=Chinu)
    DB-->>FastAPI: row
    FastAPI->>WS-Hub: cart_update{op:create,item:{id:100,qty:1,version:1,…},tmpId:c1}
    WS-Hub-->>Chinu-Phone: cart_update (tmp→real row)
    WS-Hub-->>Anshu-Phone: cart_update (insert row)

    %% ───────────────── 2  Member tries to edit (blocked) ─────────────────
    Note right of Anshu-Phone: Buttons disabled → no call sent

    %% ───────────────── 3  Host increases qty ─────────────────
    Note over Chinu-Phone: local optimistic qty 2
    Chinu-Phone->>WS-Hub: cart_mutate{op:update,id:100,version:1,qty:2}
    WS-Hub->>FastAPI: host authorised
    FastAPI->>DB: UPDATE … SET qty=2, version=2 WHERE id=100 AND version=1
    DB-->>FastAPI: 1 row
    FastAPI->>WS-Hub: cart_update{op:update,item:{id:100,qty:2,version:2}}
    WS-Hub-->>Chinu-Phone: cart_update (v2 == local v2 ⇒ ignore)
    WS-Hub-->>Anshu-Phone: cart_update (v2 > local v1 ⇒ overwrite)

    %% ───────────────── 4  Stale version conflict ─────────────────
    Note over Anshu-Phone: Tries rogue PATCH with old version
    Anshu-Phone->>WS-Hub: cart_mutate{op:update,id:100,version:1,qty:3} (Frontend UI will call /cart_snapshot, and recreate cart/orders etc data)
    WS-Hub->>FastAPI: member not owner & not host ⇒ reject
    FastAPI-->>Anshu-Phone: error{code:not_authorised}

    %% ───────────────── 5  Final order firing ─────────────────
    Chinu-Phone->>FastAPI: POST /orders{session_pid:S,cart_hash:H123}
    FastAPI->>DB: recompute hash → OK
    FastAPI->>DB: INSERT orders(..., payload=[{id:100,qty:2,...}])
    FastAPI-->>Chinu-Phone: 201 {order_id:o789,ticket:K-88}
    FastAPI->>WS-Hub: order_fired{order:{id:o789,ticket:K-88,items:[…]}}
    WS-Hub-->>Anshu-Phone: order_fired
    WS-Hub-->>Chinu-Phone: order_fired