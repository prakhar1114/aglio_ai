#!/usr/bin/env python3
"""
Script to automatically create Cloudflare image variants via API
"""

import os
import sys
import requests
import json
from pathlib import Path
from loguru import logger

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent.parent))

from common.cloudflare_utils import get_headers

# Cloudflare configuration
CLOUDFLARE_ACCOUNT_ID = os.getenv('CLOUDFLARE_ACCOUNT_ID')

# Variant definitions optimized for your use case
VARIANTS = [
    {
        "id": "thumbnail",
        "options": {
            "fit": "cover",
            "width": 100,
            "height": 100
        }
    },
    {
        "id": "small",
        "options": {
            "fit": "cover",
            "width": 180,
            "height": 180
        }
    },
    {
        "id": "medium",
        "options": {
            "fit": "cover",
            "width": 360,
            "height": 360
        }
    },
    {
        "id": "large",
        "options": {
            "fit": "scale-down",
            "width": 720,
            "height": 720
        }
    },
    {
        "id": "fullscreen",
        "options": {
            "fit": "scale-down",
            "width": 1080,
            "height": 1920
        }
    }
]

def create_variant(variant_config):
    """Create a single image variant"""
    url = f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/images/v1/variants"
    
    try:
        response = requests.post(
            url,
            headers=get_headers(),
            json=variant_config,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                logger.success(f"✅ Created variant '{variant_config['id']}' - {variant_config['options']['width']}x{variant_config['options']['height']}")
                return True
            else:
                errors = result.get('errors', [])
                if any('already exists' in str(error) for error in errors):
                    logger.info(f"ℹ️  Variant '{variant_config['id']}' already exists, skipping")
                    return True
                else:
                    logger.error(f"❌ API error creating '{variant_config['id']}': {errors}")
                    return False
        else:
            logger.error(f"❌ HTTP {response.status_code} creating '{variant_config['id']}': {response.text}")
            return False
            
    except Exception as e:
        logger.error(f"❌ Exception creating variant '{variant_config['id']}': {e}")
        return False

def list_existing_variants():
    """List existing variants"""
    url = f"https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/images/v1/variants"
    
    try:
        response = requests.get(
            url,
            headers=get_headers(),
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                variants = result.get('result', {}).get('variants', [])
                logger.info(f"📋 Found {len(variants)} existing variants:")
                for variant in variants:
                    options = variant.get('options', {})
                    logger.info(f"   • {variant['id']}: {options.get('width', 'auto')}x{options.get('height', 'auto')}")
                return [v['id'] for v in variants]
            else:
                logger.error(f"❌ API error listing variants: {result.get('errors')}")
                return []
        else:
            logger.error(f"❌ HTTP {response.status_code} listing variants: {response.text}")
            return []
            
    except Exception as e:
        logger.error(f"❌ Exception listing variants: {e}")
        return []

def main():
    logger.info("🎨 Setting up Cloudflare image variants...")
    
    # Check credentials
    if not CLOUDFLARE_ACCOUNT_ID:
        logger.error("❌ CLOUDFLARE_ACCOUNT_ID environment variable not set")
        return False
    
    # List existing variants first
    existing_variants = list_existing_variants()
    
    # Create new variants
    success_count = 0
    total_count = len(VARIANTS)
    
    for variant in VARIANTS:
        if create_variant(variant):
            success_count += 1
    
    logger.info(f"🎯 Setup complete: {success_count}/{total_count} variants configured")
    
    if success_count == total_count:
        logger.success("✅ All variants created successfully!")
        logger.info("\n📝 Next steps:")
        logger.info("1. Test image uploads with: python test_cloudflare_upload.py")
        logger.info("2. Update your frontend code to use variants")
        logger.info("3. Configure Cloudflare Stream settings in the dashboard")
        return True
    else:
        logger.warning(f"⚠️  {total_count - success_count} variants failed to create")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 