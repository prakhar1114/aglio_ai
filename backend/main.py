from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import uvicorn
from loguru import logger
import sys
from contextlib import asynccontextmanager
from models.schema import init_db


from config import rdb, qd, root_dir, DEBUG_MODE, image_dir
# from middleware.tenant_resolver import tenant_middleware, tenant_resolver, get_qdrant_collection
# from urls.filtered_recommendations import router as filtered_router
from urls.menu import router as menu_router
# from urls.chat import router as chat_router
from urls.categories import router as categories_router
# from urls.featured import router as featured_router
# from urls.prev_orders import router as prev_orders_router
from urls.upsell import router as upsell_router
# from urls.settings import router as settings_router
from urls.admin.dashboard import router as admin_router
from urls.admin.dashboard_ws import router as admin_ws_router
from urls.table_session import router as table_session_router
from urls.session_ws import router as session_ws_router
from urls.cart import router as cart_router



init_db()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan event handler"""
    # Startup
    logger.info("🚀 Starting Aglio Multi-Tenant Restaurant API")
    logger.info(f"🔧 Debug mode: {DEBUG_MODE}")
    
    # Display loaded restaurants status
    # tenant_count = len(tenant_resolver.restaurants_data)
    # logger.info(f"🏪 Found {tenant_count} restaurants")
    
    # if tenant_count == 0:
    #     logger.warning("⚠️  No restaurants loaded! Check restaurant_onboarding.json")
    # else:
    #     for subdomain, info in tenant_resolver.restaurants_data.items():
    #         status = "✅ Ready" if info.get("added2qdrant") else "⏳ Pending"
    #         logger.info(f"   • {info['restaurant_name']} -> {subdomain}.aglioapp.com ({status})")
    
    yield
    
    # Shutdown (if needed)
    logger.info("🛑 Shutting down Aglio Multi-Tenant Restaurant API")

# Create the FastAPI app with lifespan
app = FastAPI(
    title="Aglio Multi-Tenant Restaurant API",
    description="Multi-tenant restaurant recommendation and menu system",
    version="2.0.0",
    lifespan=lifespan
)

# Add tenant middleware first (before other middlewares)
# app.middleware("http")(tenant_middleware)

app.mount(
    "/image_data",
    StaticFiles(directory=image_dir),
    name="image_data",
)

# Mount static files for admin dashboard
import os
admin_static_dir = os.path.join(os.path.dirname(__file__), "urls", "admin", "static")
if os.path.exists(admin_static_dir):
    app.mount("/admin/static", StaticFiles(directory=admin_static_dir), name="admin_static")

# Include routers
app.include_router(categories_router, tags=["categories"])  # No prefix - full path in router
app.include_router(menu_router, tags=["menu"])  # No prefix - full path in router
# app.include_router(filtered_router, prefix="/filtered_recommendations", tags=["recommendations"])
# app.include_router(featured_router, prefix="/featured", tags=["featured"])
# app.include_router(prev_orders_router, prefix="/prev_orders", tags=["orders"])
app.include_router(upsell_router, prefix="/upsell", tags=["upsell"])
# app.include_router(settings_router, prefix="/settings", tags=["settings"])
app.include_router(admin_router, prefix="/admin", tags=["admin"])
app.include_router(admin_ws_router, prefix="/admin", tags=["admin_ws"])
app.include_router(table_session_router, tags=["table_session"])
app.include_router(session_ws_router, tags=["session_ws"])
app.include_router(cart_router, tags=["cart"])


# CORS configuration
allowed_origins = ["*"] if DEBUG_MODE else [
    "https://aglioapp.com",
    "https://*.aglioapp.com",
    "https://agliomenu.vercel.app",
    "https://pin-menuapp.vercel.app",
    "https://urchin-creative-supposedly.ngrok-free.app",
]

app.add_middleware(
    CORSMiddleware, 
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    """Health check endpoint"""
    return {"status": "healthy", "debug_mode": DEBUG_MODE}

@app.get("/tenant-info")
def tenant_info(request: Request):
    """Get current tenant information (useful for debugging)"""
    return {
        "tenant_id": request.state.tenant_id,
        "restaurant_name": request.state.tenant_info["restaurant_name"],
        "collection_name": request.state.qdrant_collection_name,
        "debug_mode": DEBUG_MODE
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8005,
        reload=DEBUG_MODE
    )
