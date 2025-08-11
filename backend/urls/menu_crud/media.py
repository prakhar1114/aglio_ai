from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import aiofiles
import os
import tempfile
import requests
from loguru import logger
import uuid
import re
from urllib.parse import urlparse
import os
from pathlib import Path

from models.schema import SessionLocal, MenuItem, Restaurant
from .auth import get_restaurant_from_auth
from .embeddings import generate_embeddings_for_menu_item
from common.utils import is_url, is_instagram_url, is_google_drive_url, download_instagram_content, download_google_drive_content, download_url_content
from common.cloudflare_utils import upload_media_to_cloudflare

router = APIRouter()

class MediaUploadResponse(BaseModel):
    cloudflare_image_id: Optional[str] = None
    cloudflare_video_id: Optional[str] = None
    success: bool
    message: str

async def download_file_from_url(url: str) -> bytes:
    """Download file from URL with support for Google Drive and Instagram"""
    try:
        if is_instagram_url(url):
            # Handle Instagram URLs
            downloaded_path, content_type, success = download_instagram_content(url, "/tmp", "temp")
            if not success:
                raise Exception("Failed to download Instagram content")
            with open(downloaded_path, 'rb') as f:
                return f.read()
        elif is_google_drive_url(url):
            # Handle Google Drive URLs
            downloaded_path, content_type, success = download_google_drive_content(url, "/tmp", "temp")
            if not success:
                raise Exception("Failed to download Google Drive content")
            with open(downloaded_path, 'rb') as f:
                return f.read()
        else:
            # Handle regular URLs
            downloaded_path, content_type, success = download_url_content(url, "/tmp", "temp")
            if not success:
                raise Exception("Failed to download URL content")
            with open(downloaded_path, 'rb') as f:
                return f.read()
    except Exception as e:
        logger.error(f"Failed to download file from {url}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to download file from URL: {str(e)}"
        )

async def upload_to_cloudflare(file_content: bytes, filename: str, item_name: str, restaurant_slug: str) -> tuple[Optional[str], Optional[str], bool, str]:
    """Upload file to Cloudflare using existing function"""
    try:
        # Save file content to temporary file
        temp_dir = "/tmp"
        os.makedirs(temp_dir, exist_ok=True)
        temp_path = os.path.join(temp_dir, filename)
        
        with open(temp_path, 'wb') as f:
            f.write(file_content)
        
        # Use existing upload function
        cf_image_id, cf_video_id, success, message = upload_media_to_cloudflare(
            temp_path, item_name, restaurant_slug
        )
        
        # Clean up temp file
        os.remove(temp_path)
        
        return cf_image_id, cf_video_id, success, message
        
    except Exception as e:
        logger.error(f"Failed to upload to Cloudflare: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload to Cloudflare: {str(e)}"
        )

@router.post("/upload-media", response_model=MediaUploadResponse)
async def upload_media(
    file: UploadFile = File(...),
    restaurant: Restaurant = Depends(get_restaurant_from_auth)
):
    """Upload media file to Cloudflare"""
    try:
        # Validate file
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )
        
        # Check file size (10MB limit)
        file_content = await file.read()
        if len(file_content) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File too large. Maximum size is 10MB"
            )
        
        # Determine file type
        content_type = file.content_type or ''
        is_video = content_type.startswith('video/')
        is_image = content_type.startswith('image/')
        
        if not is_image and not is_video:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only image and video files are supported"
            )
        
        # Upload to Cloudflare
        cf_image_id, cf_video_id, success, message = await upload_to_cloudflare(
            file_content, file.filename, "menu_item", restaurant.slug
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Cloudflare upload failed: {message}"
            )
        
        if cf_video_id:
            logger.info(f"✅ Uploaded video to Cloudflare: {cf_video_id}")
            return MediaUploadResponse(
                cloudflare_video_id=cf_video_id,
                success=True,
                message="Video uploaded successfully"
            )
        else:
            logger.info(f"✅ Uploaded image to Cloudflare: {cf_image_id}")
            return MediaUploadResponse(
                cloudflare_image_id=cf_image_id,
                success=True,
                message="Image uploaded successfully"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Media upload error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during upload"
        )

@router.post("/upload-media-from-url", response_model=MediaUploadResponse)
async def upload_media_from_url(
    url: str,
    restaurant: Restaurant = Depends(get_restaurant_from_auth)
):
    """Upload media from URL to Cloudflare"""
    try:
        # Validate URL
        if not url.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No URL provided"
            )
        
        if not is_url(url):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid URL provided"
            )
        
        # Download file from URL
        logger.info(f"📥 Downloading file from URL: {url}")
        file_content = await download_file_from_url(url)
        
        # Check file size (10MB limit)
        if len(file_content) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File too large. Maximum size is 10MB"
            )
        
        # Determine file type from URL or content
        filename = f"uploaded_{uuid.uuid4().hex[:8]}"
        if any(ext in url.lower() for ext in ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm']):
            is_video = True
            filename += '.mp4'
        elif any(ext in url.lower() for ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']):
            is_video = False
            filename += '.jpg'
        else:
            # Try to determine from content type or default to image
            is_video = False
            filename += '.jpg'
        
        # Upload to Cloudflare
        cf_image_id, cf_video_id, success, message = await upload_to_cloudflare(
            file_content, filename, "menu_item", restaurant.slug
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Cloudflare upload failed: {message}"
            )
        
        if cf_video_id:
            logger.info(f"✅ Uploaded video from URL to Cloudflare: {cf_video_id}")
            return MediaUploadResponse(
                cloudflare_video_id=cf_video_id,
                success=True,
                message="Video uploaded successfully from URL"
            )
        else:
            logger.info(f"✅ Uploaded image from URL to Cloudflare: {cf_image_id}")
            return MediaUploadResponse(
                cloudflare_image_id=cf_image_id,
                success=True,
                message="Image uploaded successfully from URL"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Media upload from URL error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during URL upload"
        )

@router.post("/update-menu-item-media")
async def update_menu_item_media(
    public_id: str,
    cloudflare_image_id: Optional[str] = None,
    cloudflare_video_id: Optional[str] = None,
    restaurant: Restaurant = Depends(get_restaurant_from_auth)
):
    """Update menu item with new media"""
    try:
        with SessionLocal() as db:
            # Find the menu item
            menu_item = db.query(MenuItem).filter(
                MenuItem.public_id == public_id,
                MenuItem.restaurant_id == restaurant.id
            ).first()
            
            if not menu_item:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Menu item not found"
                )
            
            # Store old values for rollback
            old_image_id = menu_item.cloudflare_image_id
            old_video_id = menu_item.cloudflare_video_id
            
            try:
                # Update media fields
                if cloudflare_image_id is not None:
                    menu_item.cloudflare_image_id = cloudflare_image_id
                    menu_item.cloudflare_video_id = None  # Clear video if image is set
                elif cloudflare_video_id is not None:
                    menu_item.cloudflare_video_id = cloudflare_video_id
                    menu_item.cloudflare_image_id = None  # Clear image if video is set
                
                # Commit database changes first
                db.commit()
                
                # Generate embeddings after successful database update
                embedding_success = await generate_embeddings_for_menu_item(menu_item.id)
                
                if not embedding_success:
                    # If embedding generation fails, we don't rollback the media update
                    # but we log the issue
                    logger.warning(f"⚠️ Media updated but embedding generation failed for menu item: {public_id}")
                
                logger.info(f"✅ Updated menu item media: {public_id}")
                return {"success": True, "message": "Media updated successfully"}
                
            except Exception as e:
                # Rollback on error
                menu_item.cloudflare_image_id = old_image_id
                menu_item.cloudflare_video_id = old_video_id
                db.rollback()
                raise e
                
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating menu item media: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        ) 