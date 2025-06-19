from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
import json
from pathlib import Path
from typing import Dict, Optional
from loguru import logger


class TenantResolver:
    def __init__(self):
        self.restaurants_data: Dict[str, dict] = {}
        self._data_loaded = False
        self.load_restaurant_data()
    
    def load_restaurant_data(self):
        """Load restaurant configuration from onboarding JSON"""
        # Prevent duplicate loading
        if self._data_loaded:
            logger.debug("Restaurant data already loaded, skipping...")
            return
            
        onboarding_file = Path(__file__).parent.parent / "restaurant_onboarding.json"
        
        if not onboarding_file.exists():
            logger.error(f"Restaurant onboarding file not found: {onboarding_file}")
            return
        
        try:
            with open(onboarding_file, 'r') as f:
                restaurants_list = json.load(f)
            
            # Convert list to dict keyed by subdomain for fast lookup
            for restaurant in restaurants_list:
                subdomain = restaurant.get("subdomain")
                if subdomain:
                    self.restaurants_data[subdomain] = restaurant
                    logger.info(f"Loaded restaurant: {restaurant['restaurant_name']} -> {subdomain}.aglioapp.com")
            
            logger.success(f"Loaded {len(self.restaurants_data)} restaurants")
            self._data_loaded = True
            
        except Exception as e:
            logger.error(f"Error loading restaurant data: {e}")
    
    def extract_tenant_from_host(self, host: str, debug_mode: bool = False) -> Optional[str]:
        """Extract tenant subdomain from host header"""
        if debug_mode:
            # In debug mode, allow localhost and return default tenant
            if "localhost" in host or "127.0.0.1" in host or "192.168.1" in host:
                # Return first available tenant for local development
                if self.restaurants_data:
                    default_tenant = list(self.restaurants_data.keys())[0]
                    logger.debug(f"Debug mode: Using default tenant '{default_tenant}' for localhost")
                    return default_tenant
                return None
        
        # Extract subdomain from host like "chianti.aglioapp.com"
        if ".aglioapp.com" in host:
            subdomain = host.split(".aglioapp.com")[0]
            # Handle nested subdomains (take the last part)
            if "." in subdomain:
                subdomain = subdomain.split(".")[-1]
            return subdomain
        
        return None
    
    def get_tenant_info(self, tenant_id: str) -> Optional[dict]:
        """Get tenant configuration by subdomain"""
        return self.restaurants_data.get(tenant_id)
    
    def validate_tenant(self, tenant_id: str) -> bool:
        """Check if tenant exists and is properly configured"""
        tenant_info = self.get_tenant_info(tenant_id)
        if not tenant_info:
            return False
        
        # Check if tenant has been added to Qdrant
        return tenant_info.get("added2qdrant", False)


# Global tenant resolver instance
tenant_resolver = TenantResolver()


async def tenant_middleware(request: Request, call_next):
    """
    Middleware to resolve tenant from subdomain and add to request state
    
    Args:
        request: The incoming FastAPI request
        call_next: A function that calls the next middleware or endpoint handler in the chain
                  - This is how middleware passes control to the next step
                  - It returns the response from the next handler
                  - Without calling call_next, the request would stop here
    
    Flow:
        1. Extract tenant from subdomain (e.g., "chianti.aglioapp.com" -> "chianti")
        2. Validate tenant exists and is configured
        3. Add tenant info to request.state for use in endpoints
        4. Call call_next() to continue to the actual endpoint
        5. Return the response from the endpoint
    """
    
    # Skip tenant resolution for documentation and system routes
    skip_paths = {
        "/docs", "/redoc", "/openapi.json", 
        "/health", "/",  # system endpoints
        "/image_data"  # static files
    }
    
    # Check if current path should skip tenant resolution
    path = request.url.path
    if path in skip_paths or path.startswith("/image_data/") or path.startswith("/settings"):
        logger.debug(f"Skipping tenant resolution for system path: {path}")
        return await call_next(request)
    
    # Get debug mode from config (we'll import this dynamically to avoid circular imports)
    try:
        from config import DEBUG_MODE
    except ImportError:
        DEBUG_MODE = False
    
    host = request.headers.get("host", "")
    tenant_id = tenant_resolver.extract_tenant_from_host(host, DEBUG_MODE)
    
    if not tenant_id:
        logger.warning(f"No tenant found for host: {host}")
        return JSONResponse(
            status_code=400,
            content={"error": "Invalid subdomain", "host": host}
        )
    
    # Validate tenant exists and is configured
    if not tenant_resolver.validate_tenant(tenant_id):
        logger.warning(f"Tenant not found or not configured: {tenant_id}")
        return JSONResponse(
            status_code=404,
            content={"error": "Restaurant not found", "tenant": tenant_id}
        )
    
    # Add tenant info to request state for use in endpoints
    tenant_info = tenant_resolver.get_tenant_info(tenant_id)
    request.state.tenant_id = tenant_id
    request.state.tenant_info = tenant_info
    request.state.qdrant_collection_name = tenant_info["qdrant_db_name"]
    
    logger.debug(f"Request for tenant: {tenant_id} ({tenant_info['restaurant_name']})")
    
    # CRITICAL: Call the next middleware or endpoint handler
    # Without this, the request would stop here and never reach your endpoints
    response = await call_next(request)
    
    # You can modify the response here if needed (e.g., add headers)
    # response.headers["X-Tenant-ID"] = tenant_id
    
    return response


def get_tenant_from_request(request: Request) -> dict:
    """Helper function to get tenant info from request state"""
    if not hasattr(request.state, 'tenant_info'):
        raise HTTPException(status_code=500, detail="Tenant not resolved")
    return request.state.tenant_info


def get_qdrant_collection(request: Request) -> str:
    """Helper function to get Qdrant collection name for current tenant"""
    if not hasattr(request.state, 'qdrant_collection_name'):
        raise HTTPException(status_code=500, detail="Tenant not resolved")
    return request.state.qdrant_collection_name 