from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
import uvicorn
from loguru import logger
import sys
from contextlib import asynccontextmanager

from config import rdb, qd, root_dir, DEBUG_MODE
from middleware.tenant_resolver import tenant_middleware, tenant_resolver, get_qdrant_collection
from urls.filtered_recommendations import router as filtered_router
from urls.menu import router as menu_router
from urls.chat import router as chat_router
from urls.categories import router as categories_router
from urls.featured import router as featured_router
from urls.prev_orders import router as prev_orders_router
from urls.upsell import router as upsell_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan event handler"""
    # Startup
    logger.info("🚀 Starting Aglio Multi-Tenant Restaurant API")
    logger.info(f"🔧 Debug mode: {DEBUG_MODE}")
    
    # Display loaded restaurants status
    tenant_count = len(tenant_resolver.restaurants_data)
    logger.info(f"🏪 Found {tenant_count} restaurants")
    
    if tenant_count == 0:
        logger.warning("⚠️  No restaurants loaded! Check restaurant_onboarding.json")
    else:
        for subdomain, info in tenant_resolver.restaurants_data.items():
            status = "✅ Ready" if info.get("added2qdrant") else "⏳ Pending"
            logger.info(f"   • {info['restaurant_name']} -> {subdomain}.aglioapp.com ({status})")
    
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
app.middleware("http")(tenant_middleware)

app.mount(
    "/image_data",
    StaticFiles(directory=root_dir / "raw_data"),
    name="image_data",
)

# Include routers
app.include_router(categories_router, prefix="/categories", tags=["categories"])
app.include_router(menu_router, prefix="/menu", tags=["menu"])
app.include_router(filtered_router, prefix="/filtered_recommendations", tags=["recommendations"])
app.include_router(featured_router, prefix="/featured", tags=["featured"])
app.include_router(prev_orders_router, prefix="/prev_orders", tags=["orders"])
app.include_router(upsell_router, prefix="/upsell", tags=["upsell"])
app.include_router(chat_router)

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
