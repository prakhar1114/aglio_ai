import pandas as pd
import numpy as np
import torch
import clip
import pathlib
import qdrant_client
from sentence_transformers import SentenceTransformer
from PIL import Image
import json
import sys
import os
import uuid
from pathlib import Path
from loguru import logger

# Add parent directory to path to import config
sys.path.append(str(Path(__file__).parent.parent))
from config import root_dir
from common.utils import download_instagram_content, download_url_content, is_url, is_instagram_url

# Initialize models
mps = torch.backends.mps.is_available()
device = "mps" if mps else "cpu"

txt_model = SentenceTransformer("all-mpnet-base-v2", device=device)
clip_model, preprocess = clip.load("ViT-B/32", device="cpu")

def generate_short_uuid():
    """Generate a 6-character unique ID"""
    return str(uuid.uuid4()).replace('-', '')[:6]

def build_embeddings(restaurant_data):
    """Build embeddings for a restaurant's menu items from CSV file and image directory"""
    restaurant_name = restaurant_data["restaurant_name"]
    csv_file = restaurant_data["csv_file"]
    image_directory = restaurant_data["image_directory"]
    
    logger.info(f"🏗️  Building embeddings for {restaurant_name}...")
    logger.info(f"📄 Reading CSV: {csv_file}")
    logger.info(f"🖼️  Image directory: {image_directory}")
    
    # Check if CSV file exists
    if not os.path.exists(csv_file):
        logger.error(f"❌ CSV file not found: {csv_file}")
        return None
    
    # Check if image directory exists
    if not os.path.exists(image_directory):
        logger.error(f"❌ Image directory not found: {image_directory}")
        return None
    
    # Read CSV file
    df = pd.read_csv(csv_file)
    logger.info(f"📊 Loaded {len(df)} items from CSV")
    
    # Ensure we have the required columns
    required_columns = ['name', 'description']
    # Use category_brief if available, otherwise fall back to category
    if 'category_brief' in df.columns:
        required_columns.append('category_brief')
    elif 'category' in df.columns:
        required_columns.append('category')
    else:
        logger.error(f"❌ Missing category column in CSV")
        return None
    
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        logger.error(f"❌ Missing required columns in CSV: {missing_columns}")
        return None
    
    # Filter rows based on ADDED and FORCE_UPDATE flags
    rows_to_process = []
    for idx, row in df.iterrows():
        added = row.get('ADDED', False)
        force_update = row.get('FORCE_UPDATE', False)
        
        if force_update:
            logger.info(f"🔄 Processing {row['name']} - FORCE_UPDATE=True")
            rows_to_process.append(idx)
        elif not added:
            logger.info(f"➕ Processing {row['name']} - ADDED=False")
            rows_to_process.append(idx)
        # else:
        #     logger.info(f"⏭️  Skipping {row['name']} - ADDED=True, FORCE_UPDATE=False")
    
    if not rows_to_process:
        logger.info("🔄 No rows to process - all items already added and no force updates")
        return pd.DataFrame()  # Return empty dataframe
    
    # Process only the rows that need to be processed
    df_to_process = df.iloc[rows_to_process].copy()
    
    vecs = []
    public_ids = []
    image_dir_path = Path(image_directory)
    
    # Use category_brief if available, otherwise use category
    category_column = 'category_brief'
    
    for idx, row in df_to_process.iterrows():
        # Generate unique public ID for this dish
        public_id = generate_short_uuid()
        public_ids.append(public_id)
        
        # Create text embedding
        text = f"{row['name']} - {row[category_column]} - {row['description']}"
        t_vec = txt_model.encode(text)
        
        # Handle image_path URLs and download them
        # First check if row has image_path field and if it contains a URL
        if 'image_path' in row and pd.notna(row['image_path']) and is_url(str(row['image_path'])):
            image_url = str(row['image_path']).strip()
            logger.info(f"🔗 Found URL in image_path for {row['name']}: {image_url}")
            
            # Generate base filename for download
            safe_name = str(row['name']).replace(' ', '_').replace('/', '_').replace('\\', '_')
            base_filename = f"{idx}_{safe_name}"
            
            try:
                downloaded_path = None
                if is_instagram_url(image_url):
                    # Handle Instagram URLs
                    logger.info(f"📸 Downloading Instagram content for {row['name']}")
                    downloaded_path, content_type, success = download_instagram_content(
                        image_url, str(image_dir_path), base_filename
                    )
                else:
                    # Handle regular URLs
                    logger.info(f"🌐 Downloading content from URL for {row['name']}")
                    downloaded_path, content_type, success = download_url_content(
                        image_url, str(image_dir_path), base_filename
                    )
                
                if success and downloaded_path:
                    # Update the image_path in the dataframe with just the filename
                    new_filename = Path(downloaded_path).name
                    df_to_process.at[idx, 'image_path'] = new_filename
                    logger.success(f"✅ Downloaded and updated image_path for {row['name']}: {new_filename}")
                else:
                    # Download failed, set image_path to null
                    df_to_process.at[idx, 'image_path'] = None
                    logger.warning(f"⚠️  Failed to download URL for {row['name']}, setting image_path to null")
                    
            except Exception as e:
                logger.error(f"❌ Error downloading URL for {row['name']}: {e}")
                df_to_process.at[idx, 'image_path'] = None

        # Try to find and process image
        try:
            # Look for image file with same name as the dish
            # Try common image extensions
            image_found = False
            
            # First check if there's an image_path specified in the CSV
            if 'image_path' in row and pd.notna(row['image_path']) and not is_url(str(row['image_path'])):
                # Try the specified image path first
                specified_image_path = image_dir_path / str(row['image_path'])
                if specified_image_path.exists():
                    try:
                        img = preprocess(Image.open(specified_image_path)).unsqueeze(0)
                        with torch.no_grad():
                            i_vec = clip_model.encode_image(img)[0].cpu().numpy()
                        image_found = True
                        logger.info(f"📷 Using specified image: {row['image_path']}")
                    except Exception as e:
                        logger.warning(f"⚠️  Error processing specified image {row['image_path']}: {e}")
            
            if not image_found:
                # Fall back to searching for image files
                for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG', '.mp4', '.webm', '.gif']:
                    # Try with dish name
                    dish_name = str(row['name']).replace(' ', '_').replace('/', '_')
                    image_path = image_dir_path / f"{dish_name}{ext}"
                    
                    if image_path.exists():
                        # Only process image files for embedding, skip videos
                        if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif']:
                            try:
                                img = preprocess(Image.open(image_path)).unsqueeze(0)
                                with torch.no_grad():
                                    i_vec = clip_model.encode_image(img)[0].cpu().numpy()
                                image_found = True
                                logger.info(f"📷 Found image by name: {image_path.name}")
                                break
                            except Exception as e:
                                logger.warning(f"⚠️  Error processing image {image_path.name}: {e}")
                                continue
                        else:
                            # For video files, just mark as found but use zero vector
                            image_found = True
                            i_vec = np.zeros(512)
                            logger.info(f"🎥 Found video file: {image_path.name} (no embedding generated)")
                            break
                    
                    # Try with index
                    image_path = image_dir_path / f"{idx}{ext}"
                    if image_path.exists():
                        # Only process image files for embedding, skip videos
                        if ext.lower() in ['.jpg', '.jpeg', '.png', '.gif']:
                            try:
                                img = preprocess(Image.open(image_path)).unsqueeze(0)
                                with torch.no_grad():
                                    i_vec = clip_model.encode_image(img)[0].cpu().numpy()
                                image_found = True
                                logger.info(f"📷 Found image by index: {image_path.name}")
                                break
                            except Exception as e:
                                logger.warning(f"⚠️  Error processing image {image_path.name}: {e}")
                                continue
                        else:
                            # For video files, just mark as found but use zero vector
                            image_found = True
                            i_vec = np.zeros(512)
                            logger.info(f"🎥 Found video file: {image_path.name} (no embedding generated)")
                            break
            
            if not image_found:
                i_vec = np.zeros(512)
                logger.info(f"📷 No image found for {row['name']}, using zero vector")
                
        except Exception as e:
            logger.warning(f"⚠️  Error processing image for {row['name']}: {e}")
            i_vec = np.zeros(512)

        vecs.append(np.concatenate([t_vec, i_vec]))
    
    # Add vectors and public IDs to dataframe
    df_to_process["vector"] = vecs
    df_to_process["public_id"] = public_ids
    
    # Add IDs if not present
    if 'id' not in df_to_process.columns:
        df_to_process['id'] = range(len(df_to_process))
    
    # Define columns to keep (exclude ADDED and FORCE_UPDATE)
    columns_to_keep = [
        'id', 'name', 'category_brief', 'group_category', 'description', 
        'price', 'image_path', 'veg_flag', 'is_bestseller', 'is_recommended', 
        'kind', 'priority', 'public_id', 'vector', 'promote'
    ]
    
    # Keep only columns that exist in the dataframe
    existing_columns = [col for col in columns_to_keep if col in df_to_process.columns]
    df_filtered = df_to_process[existing_columns]
    
    logger.success(f"✅ Embeddings generated for {restaurant_name}")
    logger.info(f"📊 Processed {len(df_filtered)} items out of {len(df)} total items")
    
    return df_filtered

def push_to_qdrant(restaurant_name, df):
    """Push restaurant data to Qdrant"""
    logger.info(f"📤 Pushing {restaurant_name} to Qdrant...")
    
    if df is None:
        logger.error(f"❌ No processed data for {restaurant_name}")
        return False
    
    if len(df) == 0:
        logger.info(f"⏭️  No items to upload for {restaurant_name}")
        return f"{restaurant_name}_dishes"
    
    # Create Qdrant collection name
    collection_name = f"{restaurant_name}_dishes"
    
    try:
        client = qdrant_client.QdrantClient("localhost", port=6333)  # local
        
        # Check if collection exists using collections list
        collections = client.get_collections().collections
        collection_names = [col.name for col in collections]
        collection_exists = collection_name in collection_names
        
        if collection_exists:
            logger.info(f"📋 Collection {collection_name} already exists, updating records...")
        else:
            logger.info(f"🆕 Collection {collection_name} doesn't exist, creating new collection...")
            try:
                client.create_collection(
                    collection_name=collection_name,
                    vectors_config=qdrant_client.http.models.VectorParams(
                        size=1280, distance="Cosine"
                    )
                )
                logger.success(f"✅ Created new collection: {collection_name}")
            except Exception as create_error:
                if "already exists" in str(create_error):
                    logger.info(f"📋 Collection {collection_name} was created by another process, continuing...")
                    collection_exists = True
                else:
                    raise create_error
        
        # Prepare points for upsert
        points = []
        for idx, row in df.iterrows():
            point = qdrant_client.http.models.PointStruct(
                id=int(row["id"]),
                vector=row["vector"].tolist(),
                payload=row.drop(["vector", "id"]).to_dict()
            )
            points.append(point)
        
        # Upsert points (this will add new points or update existing ones)
        client.upsert(
            collection_name=collection_name,
            points=points
        )
        
        logger.success(f"✅ {restaurant_name} vectors {'added to' if collection_exists else 'uploaded to'} Qdrant ({len(df)} items)")
        return collection_name
    except Exception as e:
        logger.error(f"❌ Error uploading to Qdrant: {e}")
        return False

def update_csv_flags(restaurant_data, processed_df=None):
    """Update ADDED flags and image_path URLs in the original CSV file"""
    csv_file = restaurant_data["csv_file"]
    if not os.path.exists(csv_file):
        logger.error(f"❌ CSV file not found: {csv_file}")
        return False
    
    df = pd.read_csv(csv_file)
    
    # Set ADDED=True for all rows (since we only process rows that need processing)
    # Reset FORCE_UPDATE=False for processed rows
    for idx, row in df.iterrows():
        added = row.get('ADDED', False)
        force_update = row.get('FORCE_UPDATE', False)
        
        if force_update or not added:
            df.at[idx, 'ADDED'] = True
            df.at[idx, 'FORCE_UPDATE'] = False
    
    # Update image_path values if processed_df is provided (URLs converted to filenames)
    if processed_df is not None and 'image_path' in processed_df.columns:
        for idx, row in processed_df.iterrows():
            if idx in df.index and 'image_path' in df.columns:
                # Update the image_path in the original CSV
                df.at[idx, 'image_path'] = row['image_path']
        logger.info(f"📄 Updated image_path values for downloaded URLs")
    
    df.to_csv(csv_file, index=False)
    logger.success(f"✅ Updated CSV flags and image paths in {csv_file}")
    return True

def update_onboarding_json(restaurant_data, collection_name):
    """Update the restaurant onboarding JSON with Qdrant info"""
    restaurant_data["added2qdrant"] = True
    restaurant_data["qdrant_db_name"] = collection_name
    return restaurant_data

def main():
    # Read restaurant onboarding JSON
    onboarding_file = Path(__file__).parent.parent / "restaurant_onboarding.json"
    
    if not onboarding_file.exists():
        logger.error(f"❌ Onboarding file not found: {onboarding_file}")
        return
    
    with open(onboarding_file, 'r') as f:
        restaurants_data = json.load(f)
    
    updated = False
    
    for restaurant_data in restaurants_data:
        restaurant_name = restaurant_data["restaurant_name"]
        
        logger.info(f"\n🍴 Processing restaurant: {restaurant_name}")
        
        # Step 1: Build embeddings from CSV and images (with ADDED/FORCE_UPDATE logic)
        processed_df = build_embeddings(restaurant_data)
        if processed_df is not None:
            # Step 2: Push to Qdrant
            collection_name = push_to_qdrant(restaurant_name, processed_df)
            if collection_name:
                # Step 3: Update CSV flags and image paths
                update_csv_flags(restaurant_data, processed_df)
                # Step 4: Update JSON
                restaurant_data = update_onboarding_json(restaurant_data, collection_name)
                updated = True
                logger.success(f"✅ {restaurant_name} successfully processed and added to Qdrant")
            else:
                logger.error(f"❌ Failed to push {restaurant_name} to Qdrant")
        else:
            logger.error(f"❌ Failed to build embeddings for {restaurant_name}")
    
    # Save updated JSON if any changes were made
    if updated:
        with open(onboarding_file, 'w') as f:
            json.dump(restaurants_data, f, indent=4)
        logger.success(f"\n✅ Updated onboarding file: {onboarding_file}")
    else:
        logger.info("\n🔄 No updates needed - all restaurants already processed")

if __name__ == "__main__":
    main() 