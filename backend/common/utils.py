from recommender import Blocks
from config import qd
import os
import requests
import instaloader
from loguru import logger
from pathlib import Path
import mimetypes
from urllib.parse import urlparse

def enrich_blocks(blocks: Blocks, collection_name: str) -> dict:
    """
    Enrich blocks with additional data from Qdrant.
    
    Args:
        blocks: The blocks object to enrich
        collection_name: The Qdrant collection name to use (tenant-specific)
        
    Returns:
        dict: The enriched blocks as a dictionary
    """
    blocks = blocks.model_dump() if not isinstance(blocks, dict) else blocks
    
    for block in blocks["blocks"]:
        if block["type"] == "dish_carousal":
            for option in block["options"]:
                ## fetch dish from Qdrant
                dish = qd.retrieve(collection_name, ids=[option["id"]], with_payload=True, with_vectors=False)[0]
                option["image_url"] = dish.payload.get("image_path")
                option["name"] = dish.payload.get("name")
                option["price"] = dish.payload.get("price")
                option["description"] = dish.payload.get("description")
        
        if block["type"] == "dish_card":
            dish = qd.retrieve(collection_name, ids=[block["id"]], with_payload=True, with_vectors=False)[0]
            block["image_url"] = dish.payload.get("image_path")
            block["name"] = dish.payload.get("name")
            block["price"] = dish.payload.get("price")
            block["description"] = dish.payload.get("description")

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
        
        # Extract shortcode from Instagram URL
        if "/p/" in instagram_url:
            shortcode = instagram_url.split("/p/")[1].split("/")[0]
        elif "/reel/" in instagram_url:
            shortcode = instagram_url.split("/reel/")[1].split("/")[0]
        else:
            logger.error("Invalid Instagram URL format")
            return "", "unknown", False
        
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
            # Carousel post with multiple images/videos - get first item only
            try:
                # Get the first item from the carousel
                first_node = None
                for node in post.get_sidecar():
                    first_node = node
                    break
                
                if first_node:
                    if first_node.is_video:
                        # First item is a video
                        file_path = os.path.join(save_dir, f"{base_filename}.mp4")
                        response = requests.get(first_node.video_url)
                        if response.status_code == 200:
                            with open(file_path, 'wb') as f:
                                f.write(response.content)
                            return file_path, "video", True
                    else:
                        # First item is an image
                        file_path = os.path.join(save_dir, f"{base_filename}.jpg")
                        response = requests.get(first_node.display_url)
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
