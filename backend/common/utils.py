from recommender import Blocks
from config import qd
from models.schema import SessionLocal, MenuItem, Restaurant
import os
import requests
import instaloader
from loguru import logger
from pathlib import Path
import mimetypes
from urllib.parse import urlparse

def enrich_blocks(blocks: Blocks, restaurant_slug: str) -> dict:
    """
    Enrich blocks with additional data from PostgreSQL MenuItem table.
    
    Args:
        blocks: The blocks object to enrich
        restaurant_slug: The restaurant slug to identify the restaurant
        tenant_id: The tenant subdomain for constructing image URLs
        
    Returns:
        dict: The enriched blocks as a dictionary
    """
    blocks = blocks.model_dump() if not isinstance(blocks, dict) else blocks
    
    with SessionLocal() as db:
        # Get restaurant_id from slug
        restaurant = db.query(Restaurant).filter_by(slug=restaurant_slug).first()
        if not restaurant:
            return blocks
        
        # Collect all dish IDs that need enrichment
        dish_ids = []
        for block in blocks["blocks"]:
            if block["type"] == "dish_carousal":
                for option in block["options"]:
                    dish_ids.append(option["id"])
            elif block["type"] == "dish_card":
                dish_ids.append(block["id"])
        
        if not dish_ids:
            return blocks
        
        # Fetch all menu items in one query
        menu_items = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.id.in_(dish_ids)
        ).all()
        
        # Create lookup dict by MenuItem.id
        menu_items_dict = {item.id: item for item in menu_items}
        
        # Enrich blocks with PostgreSQL data
        for block in blocks["blocks"]:
            if block["type"] == "dish_carousal":
                for option in block["options"]:
                    menu_item = menu_items_dict.get(option["id"])
                    if menu_item:
                        image_path = menu_item.image_path
                        option["image_url"] = f"image_data/{restaurant_slug}/{image_path}" if restaurant_slug and image_path else None
                        option["cloudflare_image_id"] = menu_item.cloudflare_image_id
                        option["cloudflare_video_id"] = menu_item.cloudflare_video_id
                        option["name"] = menu_item.name
                        option["price"] = float(menu_item.price)
                        option["description"] = menu_item.description
                        # Overwrite option["id"] with public_id
                        option["id"] = menu_item.public_id
            
            elif block["type"] == "dish_card":
                menu_item = menu_items_dict.get(block["id"])
                if menu_item:
                    image_path = menu_item.image_path
                    block["image_url"] = f"image_data/{restaurant_slug}/{image_path}" if restaurant_slug and image_path else None
                    block["cloudflare_image_id"] = menu_item.cloudflare_image_id
                    block["cloudflare_video_id"] = menu_item.cloudflare_video_id
                    block["name"] = menu_item.name
                    block["price"] = float(menu_item.price)
                    block["description"] = menu_item.description
                    # Overwrite block["id"] with public_id
                    block["id"] = menu_item.public_id

    return blocks

def download_instagram_content(instagram_url: str, save_dir: str, base_filename: str) -> tuple[str, str, bool]:
    """Download Instagram post image/video
    
    Returns:
        tuple: (file_path, content_type, success)
        content_type: 'image', 'video', or 'unknown'
        success: True if download successful
    """
    try:
        # Check if files already exist first
        image_path = os.path.join(save_dir, f"{base_filename}.jpg")
        video_path = os.path.join(save_dir, f"{base_filename}.mp4")
        
        if os.path.exists(image_path):
            logger.info(f"📁 Image already exists, skipping download: {base_filename}.jpg")
            return image_path, "image", True
        elif os.path.exists(video_path):
            logger.info(f"📁 Video already exists, skipping download: {base_filename}.mp4")
            return video_path, "video", True
        
        L = instaloader.Instaloader()
        
        # Parse URL to extract shortcode and img_index
        from urllib.parse import urlparse, parse_qs
        parsed_url = urlparse(instagram_url)
        
        # Extract shortcode from Instagram URL
        if "/p/" in instagram_url:
            shortcode = instagram_url.split("/p/")[1].split("/")[0].split("?")[0]
        elif "/reel/" in instagram_url:
            shortcode = instagram_url.split("/reel/")[1].split("/")[0].split("?")[0]
        else:
            logger.error("Invalid Instagram URL format")
            return "", "unknown", False
        
        # Extract img_index parameter (1-based in URL, convert to 0-based)
        img_index = 0  # default to first item
        query_params = parse_qs(parsed_url.query)
        if 'img_index' in query_params:
            try:
                img_index = max(0, int(query_params['img_index'][0]) - 1)  # Convert to 0-based
                logger.info(f"📍 Using img_index: {img_index + 1} (URL) -> {img_index} (0-based)")
            except (ValueError, IndexError):
                logger.warning(f"⚠️  Invalid img_index parameter, using default (0)")
                img_index = 0
        
        # Get post
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        
        # Handle different post types
        if post.typename == "GraphImage":
            # Single image
            file_path = os.path.join(save_dir, f"{base_filename}.jpg")
            response = requests.get(post.url)
            if response.status_code == 200:
                with open(file_path, 'wb') as f:
                    f.write(response.content)
                return file_path, "image", True
                
        elif post.typename == "GraphVideo":
            # Video content
            file_path = os.path.join(save_dir, f"{base_filename}.mp4")
            response = requests.get(post.video_url)
            if response.status_code == 200:
                with open(file_path, 'wb') as f:
                    f.write(response.content)
                return file_path, "video", True
                
        elif post.typename == "GraphSidecar":
            # Carousel post with multiple images/videos - get item at specified index
            try:
                # Get all carousel items using get_sidecar_nodes()
                carousel_items = list(post.get_sidecar_nodes())
                
                # Use img_index if valid, otherwise fallback to first item
                if img_index < len(carousel_items):
                    selected_node = carousel_items[img_index]
                    logger.info(f"📷 Selected carousel item {img_index + 1}/{len(carousel_items)}")
                else:
                    selected_node = carousel_items[0]
                    logger.warning(f"⚠️  img_index {img_index + 1} out of bounds (max: {len(carousel_items)}), using first item")
                
                if selected_node:
                    if selected_node.is_video:
                        # Selected item is a video
                        file_path = os.path.join(save_dir, f"{base_filename}.mp4")
                        if selected_node.video_url:  # Check if video_url is not None
                            response = requests.get(selected_node.video_url)
                            if response.status_code == 200:
                                with open(file_path, 'wb') as f:
                                    f.write(response.content)
                                return file_path, "video", True
                    else:
                        # Selected item is an image
                        file_path = os.path.join(save_dir, f"{base_filename}.jpg")
                        response = requests.get(selected_node.display_url)
                        if response.status_code == 200:
                            with open(file_path, 'wb') as f:
                                f.write(response.content)
                            return file_path, "image", True
            except Exception as e:
                logger.error(f"Error processing carousel post: {e}")
                return "", "unknown", False
                
    except Exception as e:
        logger.error(f"Error downloading Instagram content: {e}")
        return "", "unknown", False
    
    return "", "unknown", False

def download_url_content(url: str, save_dir: str, base_filename: str) -> tuple[str, str, bool]:
    """Download content from a regular URL
    
    Returns:
        tuple: (file_path, content_type, success)
        content_type: 'image', 'video', or 'unknown'
        success: True if download successful
    """
    try:
        # Make request to get the content
        response = requests.get(url, stream=True, timeout=30)
        response.raise_for_status()
        
        # Get content type from headers
        content_type = response.headers.get('content-type', '').lower()
        
        # Determine file extension
        extension = None
        if 'image' in content_type:
            if 'jpeg' in content_type or 'jpg' in content_type:
                extension = '.jpg'
            elif 'png' in content_type:
                extension = '.png'
            elif 'gif' in content_type:
                extension = '.gif'
            elif 'webp' in content_type:
                extension = '.webp'
            else:
                extension = '.jpg'  # Default for images
            file_type = 'image'
        elif 'video' in content_type:
            if 'mp4' in content_type:
                extension = '.mp4'
            elif 'webm' in content_type:
                extension = '.webm'
            elif 'avi' in content_type:
                extension = '.avi'
            else:
                extension = '.mp4'  # Default for videos
            file_type = 'video'
        else:
            # Try to guess from URL
            parsed_url = urlparse(url)
            path = parsed_url.path.lower()
            if any(ext in path for ext in ['.jpg', '.jpeg', '.png', '.gif', '.webp']):
                extension = Path(parsed_url.path).suffix or '.jpg'
                file_type = 'image'
            elif any(ext in path for ext in ['.mp4', '.webm', '.avi', '.mov']):
                extension = Path(parsed_url.path).suffix or '.mp4'
                file_type = 'video'
            else:
                # Default to image
                extension = '.jpg'
                file_type = 'image'
        
        # Create file path
        file_path = os.path.join(save_dir, f"{base_filename}{extension}")
        
        # Download and save the file
        with open(file_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        
        logger.info(f"✅ Downloaded {file_type} from URL: {file_path}")
        return file_path, file_type, True
        
    except Exception as e:
        logger.error(f"Error downloading URL content: {e}")
        return "", "unknown", False

def is_url(text: str) -> bool:
    """Check if a string is a URL"""
    if not text or not isinstance(text, str):
        return False
    return text.strip().startswith(('http://', 'https://'))

def is_instagram_url(url: str) -> bool:
    """Check if a URL is an Instagram URL"""
    if not url:
        return False
    return 'instagram.com' in url and ('/p/' in url or '/reel/' in url)
