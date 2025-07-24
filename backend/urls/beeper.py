

"""
Minimal Beeper backend URL module.

Exposes:
  • /push/public-key           – returns the VAPID public key
  • /push/subscribe            – stores a PushSubscription (in‑memory)
  • /push/subscribe/{hash}     – removes a subscription
And starts a background task that sends one dummy notification
to every stored subscription once a minute.

Import `register(app)` from this module in your main FastAPI file
after the app is created (it mounts the router + schedules the loop).
"""

import asyncio
import hashlib
import json
from typing import Any, Dict
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
from pywebpush import webpush, WebPushException

from config import VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY

# --------------------------------------------------------------------------- #
#  Configuration – replace with your own keys (generate via vapid_keys.py)    #
# --------------------------------------------------------------------------- #

# --------------------------------------------------------------------------- #
#  In‑memory state (fine for the first iteration; swap for a DB later)        #
# --------------------------------------------------------------------------- #

SUBSCRIPTIONS: Dict[str, Dict[str, Any]] = {}  # endpoint_hash → subscription

# --------------------------------------------------------------------------- #
#  Router                                                                     #
# --------------------------------------------------------------------------- #

router = APIRouter()


@router.get("/push/public-key")
async def get_public_key() -> Dict[str, str]:
    """Return the public key so the PWA can call pushManager.subscribe()."""
    return {"key": VAPID_PUBLIC_KEY}


@router.post("/push/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(subscription: Dict[str, Any]) -> JSONResponse:
    """
    Store/overwrite a PushSubscription.

    Body is the JSON object returned by pushManager.subscribe().
    """
    endpoint = subscription.get("endpoint")
    if not endpoint:
        raise HTTPException(400, detail="Missing endpoint in subscription")
    endpoint_hash = hashlib.sha256(endpoint.encode()).hexdigest()
    SUBSCRIPTIONS[endpoint_hash] = subscription
    return JSONResponse(status_code=201, content={})


@router.delete("/push/subscribe/{endpoint_hash}", status_code=status.HTTP_204_NO_CONTENT)
async def unsubscribe(endpoint_hash: str) -> JSONResponse:
    """Remove a stored subscription (e.g. when the user logs out)."""
    SUBSCRIPTIONS.pop(endpoint_hash, None)
    return JSONResponse(status_code=204, content={})


@router.patch("/notifications/{notification_id}/ack", status_code=status.HTTP_200_OK)
async def acknowledge_notification(notification_id: str, action_data: Dict[str, Any]) -> JSONResponse:
    """Acknowledge a notification action (accept/reject/opened)."""
    action = action_data.get("action", "opened")
    print(f"Notification {notification_id} acknowledged with action: {action}")
    return JSONResponse(status_code=200, content={"status": "acknowledged", "action": action})

# --------------------------------------------------------------------------- #
#  Push loop                                                                  #
# --------------------------------------------------------------------------- #


async def _send_dummy_notification() -> None:
    """Fan‑out a single dummy notification to every stored subscription."""
    payload = json.dumps(
        {
            "id": str(uuid4()),
            "title": "Dummy Beep",
            "body": "This is an automatic heartbeat sent every minute.",
        }
    )

    # Iterate over a *copy* so we can safely mutate SUBSCRIPTIONS on failure
    for sub in list(SUBSCRIPTIONS.values()):
        try:
            webpush(
                subscription_info=sub,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims={"sub": "mailto:admin@example.com"},
                ttl=60,
            )
        except WebPushException:
            # Drop invalid / revoked subscription
            endpoint = sub.get("endpoint", "")
            endpoint_hash = hashlib.sha256(endpoint.encode()).hexdigest()
            SUBSCRIPTIONS.pop(endpoint_hash, None)


async def _push_loop() -> None:
    """Background task: send a dummy notification every 60 seconds."""
    while True:
        await asyncio.sleep(60)
        await _send_dummy_notification()

# --------------------------------------------------------------------------- #
#  Public helper to integrate with the main FastAPI app                       #
# --------------------------------------------------------------------------- #


# def register(app) -> None:
#     """
#     Call `beeper.register(app)` in your main FastAPI file.

#     It mounts the router and starts the background push loop.
#     """
#     # app.include_router(router)

#     @app.on_event("startup")
#     async def _startup() -> None:  # pylint: disable=unused-variable
#         asyncio.create_task(_push_loop())