from fastapi import APIRouter
from .auth import router as auth_router
from .crud import router as crud_router
from .media import router as media_router

router = APIRouter()

# Include auth routes
router.include_router(auth_router, prefix="/auth", tags=["menu-auth"])

# Include CRUD routes
router.include_router(crud_router, tags=["menu-crud"])

# Include media routes
router.include_router(media_router, tags=["menu-media"]) 