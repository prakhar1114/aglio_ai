#!/usr/bin/env python3
"""
Cloudflare API integration utilities for uploading images and videos.
"""

import os
import requests
from pathlib import Path
from typing import Tuple, Optional
from loguru import logger
import mimetypes

# Cloudflare configuration from environment variables
CLOUDFLARE_ACCOUNT_ID = os.getenv('CLOUDFLARE_ACCOUNT_ID')
CLOUDFLARE_API_TOKEN = os.getenv('CLOUDFLARE_API_TOKEN')
CLOUDFLARE_ACCOUNT_HASH = os.getenv('CLOUDFLARE_ACCOUNT_HASH')

# API endpoints
CLOUDFLARE_IMAGES_API = f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/images/v1"
CLOUDFLARE_STREAM_API = f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/stream"

def get_headers():
    """Get authorization headers for Cloudflare API"""
    return {
        'Authorization': f'Bearer {CLOUDFLARE_API_TOKEN}',
    }

def is_video_file(file_path: str) -> bool:
    """Check if file is a video based on mime type"""
    mime_type, _ = mimetypes.guess_type(file_path)
    return bool(mime_type and mime_type.startswith('video/')) or file_path.endswith('.mp4')

def upload_to_cloudflare_images(file_path: str, metadata: Optional[dict] = None) -> Tuple[Optional[str], bool, str]:
    """
    Upload an image to Cloudflare Images
    
    Args:
        file_path: Path to the image file
        metadata: Optional metadata to attach to the image
    
    Returns:
        Tuple of (cloudflare_id, success, message)
    """
    if not all([CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_HASH]):
        return None, False, "Cloudflare credentials not configured"
    
    try:
        with open(file_path, 'rb') as f:
            files = {
                'file': (Path(file_path).name, f, 'image/*')
            }
            
            # Note: Cloudflare Images API doesn't support custom metadata in form uploads
            # Metadata would need to be added via a separate API call if needed
            
            response = requests.post(
                CLOUDFLARE_IMAGES_API,
                headers=get_headers(),
                files=files,
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    cloudflare_id = result['result']['id']
                    logger.success(f"✅ Uploaded image to Cloudflare: {cloudflare_id}")
                    return cloudflare_id, True, "Upload successful"
                else:
                    error_msg = result.get('errors', [{}])[0].get('message', 'Unknown error')
                    logger.error(f"❌ Cloudflare API error: {error_msg}")
                    return None, False, error_msg
            else:
                logger.error(f"❌ HTTP error {response.status_code}: {response.text}")
                return None, False, f"HTTP {response.status_code}: {response.text}"
                
    except Exception as e:
        logger.error(f"❌ Exception uploading to Cloudflare Images: {e}")
        return None, False, str(e)

def upload_to_cloudflare_stream(file_path: str, metadata: Optional[dict] = None) -> Tuple[Optional[str], bool, str]:
    """
    Upload a video to Cloudflare Stream
    
    Args:
        file_path: Path to the video file
        metadata: Optional metadata to attach to the video
    
    Returns:
        Tuple of (cloudflare_id, success, message)
    """
    if not all([CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN]):
        return None, False, "Cloudflare credentials not configured"
    
    try:
        with open(file_path, 'rb') as f:
            files = {
                'file': f
            }
            
            # Simple direct upload without metadata initially
            # Metadata can be added later via PATCH if needed
            response = requests.post(
                CLOUDFLARE_STREAM_API,
                headers=get_headers(),
                files=files,
                timeout=300  # Videos can be larger, allow more time
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get('success'):
                    cloudflare_id = result['result']['uid']
                    logger.success(f"✅ Uploaded video to Cloudflare Stream: {cloudflare_id}")
                    return cloudflare_id, True, "Upload successful"
                else:
                    error_msg = result.get('errors', [{}])[0].get('message', 'Unknown error')
                    logger.error(f"❌ Cloudflare Stream API error: {error_msg}")
                    return None, False, error_msg
            else:
                logger.error(f"❌ HTTP error {response.status_code}: {response.text}")
                return None, False, f"HTTP {response.status_code}: {response.text}"
                
    except Exception as e:
        logger.error(f"❌ Exception uploading to Cloudflare Stream: {e}")
        return None, False, str(e)

def upload_media_to_cloudflare(file_path: str, item_name: str, restaurant_slug: str) -> Tuple[Optional[str], Optional[str], bool, str]:
    """
    Upload media (image or video) to appropriate Cloudflare service
    
    Args:
        file_path: Path to the media file
        item_name: Name of the menu item (for metadata)
        restaurant_slug: Restaurant slug (for metadata)
    
    Returns:
        Tuple of (cloudflare_image_id, cloudflare_video_id, success, message)
    """
    metadata = {
        'item_name': item_name,
        'restaurant_slug': restaurant_slug,
        'original_filename': Path(file_path).name
    }
    
    if is_video_file(file_path):
        # Upload to Cloudflare Stream
        video_id, success, message = upload_to_cloudflare_stream(file_path)
        return None, video_id, success, message
    else:
        # Upload to Cloudflare Images
        image_id, success, message = upload_to_cloudflare_images(file_path)
        return image_id, None, success, message

def get_cloudflare_image_url(cloudflare_id: str, variant: str = 'public') -> str:
    """Generate Cloudflare Images URL"""
    return f"https://imagedelivery.net/{CLOUDFLARE_ACCOUNT_HASH}/{cloudflare_id}/{variant}"

def get_cloudflare_video_url(cloudflare_id: str) -> str:
    """Generate Cloudflare Stream video URL"""
    return f"https://videodelivery.net/{cloudflare_id}/manifest/video.m3u8"

def test_cloudflare_connection() -> bool:
    """Test if Cloudflare credentials are configured correctly"""
    if not all([CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN]):
        logger.error("❌ Missing Cloudflare credentials")
        return False
    
    try:
        # Test with a simple API call to list images (with limit)
        response = requests.get(
            f"{CLOUDFLARE_IMAGES_API}?per_page=1",
            headers=get_headers(),
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                logger.success("✅ Cloudflare connection test successful")
                return True
            else:
                logger.error(f"❌ Cloudflare API error: {result.get('errors')}")
                return False
        else:
            logger.error(f"❌ HTTP error {response.status_code}: {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Exception testing Cloudflare connection: {e}")
        return False 