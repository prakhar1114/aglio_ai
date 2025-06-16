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
        return False
    
    # Check if image directory exists
    if not os.path.exists(image_directory):
        logger.error(f"❌ Image directory not found: {image_directory}")
        return False
    
    # Read CSV file
    df = pd.read_csv(csv_file)
    logger.info(f"📊 Loaded {len(df)} items from CSV")
    
    # Ensure we have the required columns
    required_columns = ['name', 'category', 'description']
    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        logger.error(f"❌ Missing required columns in CSV: {missing_columns}")
        return False
    
    vecs = []
    public_ids = []
    image_dir_path = Path(image_directory)
    
    for idx, row in df.iterrows():
        # Generate unique public ID for this dish
        public_id = generate_short_uuid()
        public_ids.append(public_id)
        
        # Create text embedding
        text = f"{row['name']} - {row['category']} - {row['description']}"
        t_vec = txt_model.encode(text)
        
        # Try to find and process image
        try:
            # Look for image file with same name as the dish
            # Try common image extensions
            image_found = False
            for ext in ['.jpg', '.jpeg', '.png', '.JPG', '.JPEG', '.PNG']:
                # Try with dish name
                dish_name = str(row['name']).replace(' ', '_').replace('/', '_')
                image_path = image_dir_path / f"{dish_name}{ext}"
                
                if image_path.exists():
                    img = preprocess(Image.open(image_path)).unsqueeze(0)
                    with torch.no_grad():
                        i_vec = clip_model.encode_image(img)[0].cpu().numpy()
                    image_found = True
                    break
                
                # Try with index
                image_path = image_dir_path / f"{idx}{ext}"
                if image_path.exists():
                    img = preprocess(Image.open(image_path)).unsqueeze(0)
                    with torch.no_grad():
                        i_vec = clip_model.encode_image(img)[0].cpu().numpy()
                    image_found = True
                    break
            
            if not image_found:
                i_vec = np.zeros(512)
                
        except Exception as e:
            logger.warning(f"⚠️  Error processing image for {row['name']}: {e}")
            i_vec = np.zeros(512)

        vecs.append(np.concatenate([t_vec, i_vec]))
    
    # Add vectors and public IDs to dataframe
    df["vector"] = vecs
    df["public_id"] = public_ids
    
    # Add IDs if not present
    if 'id' not in df.columns:
        df['id'] = range(len(df))
    
    # Add group_category and category_brief columns duplicating category
    df['group_category'] = df['group_category']
    df['category_brief'] = df['category']
    df['veg_flag'] = df['is_veg']
    
    # Save processed data
    processed_data_json = root_dir / "processed" / f"{restaurant_name}_menu_with_vec.pkl"
    
    # Ensure processed directory exists
    processed_dir = root_dir / "processed"
    processed_dir.mkdir(exist_ok=True)
    
    df.to_pickle(processed_data_json)
    logger.success(f"✅ Embeddings saved to {processed_data_json}")
    return True

def push_to_qdrant(restaurant_name):
    """Push restaurant data to Qdrant"""
    logger.info(f"📤 Pushing {restaurant_name} to Qdrant...")
    
    processed_data_json = root_dir / "processed" / f"{restaurant_name}_menu_with_vec.pkl"
    
    if not os.path.exists(processed_data_json):
        logger.error(f"❌ Processed data file not found: {processed_data_json}")
        return False
    
    df = pd.read_pickle(processed_data_json)
    
    # Create Qdrant collection name
    collection_name = f"{restaurant_name}_dishes"
    
    try:
        client = qdrant_client.QdrantClient("localhost", port=6333)  # local
        client.recreate_collection(
            collection_name=collection_name,
            vectors_config=qdrant_client.http.models.VectorParams(
                size=1280, distance="Cosine"
            )
        )
        client.upload_collection(
            collection_name=collection_name,
            vectors=df["vector"].tolist(),
            payload=df.drop(columns=["vector"]).to_dict(orient="records"),
            ids=df["id"].tolist()
        )
        logger.success(f"✅ {restaurant_name} vectors uploaded to Qdrant")
        return collection_name
    except Exception as e:
        logger.error(f"❌ Error uploading to Qdrant: {e}")
        return False

def update_onboarding_json(restaurant_data, collection_name):
    """Update the restaurant onboarding JSON with Qdrant info"""
    restaurant_data["added2qdrant"] = True
    restaurant_data["qdrant_db_name"] = collection_name
    return restaurant_data

def main():
    # Configure logger
    logger.remove()  # Remove default handler
    logger.add(sys.stderr, format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>")
    
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
        
        # Check if restaurant has already been added to Qdrant
        if restaurant_data.get("added2qdrant", False):
            logger.info(f"⏭️  Skipping {restaurant_name} - already added to Qdrant")
            continue
        
        logger.info(f"\n🍴 Processing restaurant: {restaurant_name}")
        
        # Step 1: Build embeddings from CSV and images
        if build_embeddings(restaurant_data):
            # Step 2: Push to Qdrant
            collection_name = push_to_qdrant(restaurant_name)
            if collection_name:
                # Step 3: Update JSON
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