#!/usr/bin/env python3
"""
Test script for Cloudflare uploads
"""

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

from common.cloudflare_utils import test_cloudflare_connection, upload_media_to_cloudflare
from loguru import logger

def main():
    logger.info("🧪 Testing Cloudflare integration...")
    
    # Test connection first
    if not test_cloudflare_connection():
        logger.error("❌ Cloudflare connection test failed. Please check your credentials.")
        return
    
    # Test image upload (you'll need to provide a test image)
    test_image_path = "test_image.jpg"  # Replace with actual test image path
    test_video_path = "test_video.mp4"  # Replace with actual test video path
    
    if os.path.exists(test_image_path):
        logger.info(f"📸 Testing image upload: {test_image_path}")
        image_id, video_id, success, message = upload_media_to_cloudflare(
            test_image_path, 
            "Test Image", 
            "test-restaurant"
        )
        if success:
            logger.success(f"✅ Image upload successful! ID: {image_id}")
        else:
            logger.error(f"❌ Image upload failed: {message}")
    else:
        logger.warning(f"⚠️  Test image not found: {test_image_path}")
    
    if os.path.exists(test_video_path):
        logger.info(f"🎥 Testing video upload: {test_video_path}")
        image_id, video_id, success, message = upload_media_to_cloudflare(
            test_video_path, 
            "Test Video", 
            "test-restaurant"
        )
        if success:
            logger.success(f"✅ Video upload successful! ID: {video_id}")
        else:
            logger.error(f"❌ Video upload failed: {message}")
    else:
        logger.warning(f"⚠️  Test video not found: {test_video_path}")

if __name__ == "__main__":
    main() 