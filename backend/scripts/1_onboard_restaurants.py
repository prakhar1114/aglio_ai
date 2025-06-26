#!/usr/bin/env python3
"""
Seed a single restaurant folder into Postgres and Qdrant.

Usage:
    python 1_onboard_restaurants.py /abs/path/to/restaurant_folder
"""

import csv, json, uuid, hashlib, hmac, sys, os, shutil
from pathlib import Path
from datetime import datetime, date, time
import pandas as pd
import numpy as np
import torch
import clip
from sentence_transformers import SentenceTransformer
from PIL import Image
from loguru import logger

# Add parent directory to path to import config and models
sys.path.append(str(Path(__file__).parent.parent))
from models.schema import SessionLocal
from common.utils import download_instagram_content, download_url_content, is_url, is_instagram_url
from common.cloudflare_utils import upload_media_to_cloudflare
from urls.admin.auth_utils import generate_api_key
from utils.jwt_utils import create_qr_token  # Unified QR token generation
from models.schema import Restaurant, RestaurantHours, Table, DailyPass, MenuItem
from config import image_dir, qd

# Initialize ML models for embedding generation
mps = torch.backends.mps.is_available()
device = "mps" if mps else "cpu"

txt_model = SentenceTransformer("all-mpnet-base-v2", device=device)
clip_model, clip_preprocess = clip.load("ViT-B/32", device="cpu")

# ---------- helpers -----------------------------------------------------------

def new_id() -> str:
    """Generate 6‑char public_id."""
    return uuid.uuid4().hex[:6]

def validate_and_clean_csv(df_menu: pd.DataFrame) -> pd.DataFrame:
    """Validate CSV format and clean extra columns"""
    # Expected columns according to documentation
    expected_columns = [
        'name', 'category_brief', 'group_category', 'description', 
        'price', 'image_path', 'veg_flag', 'is_bestseller', 
        'is_recommended', 'kind', 'priority', 'promote', 'public_id'
    ]
    
    # Check for required columns
    required_columns = ['name', 'category_brief', 'group_category', 'description', 'price']
    missing_columns = [col for col in required_columns if col not in df_menu.columns]
    if missing_columns:
        raise ValueError(f"Missing required columns in CSV: {missing_columns}")
    
    # Filter to only expected columns (ignore extra columns like id, ADDED, FORCE_UPDATE)
    available_columns = [col for col in expected_columns if col in df_menu.columns]
    df_cleaned = df_menu[available_columns].copy()
    
    # Add missing optional columns with defaults
    for col in expected_columns:
        if col not in df_cleaned.columns:
            if col == 'public_id':
                df_cleaned[col] = None  # Will be auto-generated
            elif col in ['veg_flag', 'is_bestseller', 'is_recommended', 'promote']:
                df_cleaned[col] = False
            elif col == 'priority':
                df_cleaned[col] = 0
            elif col == 'kind':
                df_cleaned[col] = 'food'
            elif col == 'image_path':
                df_cleaned[col] = None
    
    logger.info(f"📋 CSV validated and cleaned: {len(df_cleaned)} rows, {len(available_columns)} columns")
    return df_cleaned

def process_image_urls_and_upload_to_cloudflare(df_menu: pd.DataFrame, image_directory: str, restaurant_slug: str) -> pd.DataFrame:
    """Process image_path URLs, download them, and upload to Cloudflare"""
    logger.info(f"📷 Processing image URLs and uploading to Cloudflare, target directory: {image_directory}")
    
    # Ensure image directory exists
    os.makedirs(image_directory, exist_ok=True)
    
    processed_df = df_menu.copy()
    
    # Initialize Cloudflare columns
    processed_df['cloudflare_image_id'] = None
    processed_df['cloudflare_video_id'] = None
    
    for idx, row in processed_df.iterrows():
        image_path_value = row.get('image_path')
        has_url = pd.notna(image_path_value) and is_url(str(image_path_value))
        
        local_file_path = None
        
        if has_url:
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
                        image_url, image_directory, base_filename
                    )
                else:
                    # Handle regular URLs
                    logger.info(f"🌐 Downloading content from URL for {row['name']}")
                    downloaded_path, content_type, success = download_url_content(
                        image_url, image_directory, base_filename
                    )
                
                if success and downloaded_path:
                    local_file_path = downloaded_path
                    # Update the image_path in the dataframe with just the filename (for fallback)
                    new_filename = Path(downloaded_path).name
                    processed_df.at[idx, 'image_path'] = new_filename
                    logger.success(f"✅ Downloaded {row['name']}: {new_filename}")
                else:
                    # Download failed, set image_path to null
                    processed_df.at[idx, 'image_path'] = None
                    logger.warning(f"⚠️  Failed to download URL for {row['name']}, setting image_path to null")
                    
            except Exception as e:
                logger.error(f"❌ Error downloading URL for {row['name']}: {e}")
                processed_df.at[idx, 'image_path'] = None
        else:
            # Not a URL, check if local file exists
            image_path_value = row.get('image_path')
            has_local_path = pd.notna(image_path_value)
            if has_local_path:
                local_file_path = Path(image_directory) / str(image_path_value)
                if local_file_path.exists():
                logger.info(f"📁 Using local file for {row['name']}: {image_path_value}")
                else:
                    logger.warning(f"⚠️  Local file not found for {row['name']}: {image_path_value}")
                    local_file_path = None
        
        # Upload to Cloudflare if we have a local file
        if local_file_path and Path(local_file_path).exists():
            try:
                logger.info(f"☁️  Uploading {row['name']} to Cloudflare...")
                cf_image_id, cf_video_id, cf_success, cf_message = upload_media_to_cloudflare(
                    str(local_file_path), 
                    str(row['name']), 
                    restaurant_slug
                )
                
                if cf_success:
                    processed_df.at[idx, 'cloudflare_image_id'] = cf_image_id
                    processed_df.at[idx, 'cloudflare_video_id'] = cf_video_id
                    logger.success(f"✅ Cloudflare upload successful for {row['name']}")
                else:
                    logger.warning(f"⚠️  Cloudflare upload failed for {row['name']}: {cf_message}")
                    
            except Exception as e:
                logger.error(f"❌ Exception uploading {row['name']} to Cloudflare: {e}")
    
    return processed_df

def generate_embeddings_for_menu_items(df_menu: pd.DataFrame, image_directory: str) -> pd.DataFrame:
    """Generate embeddings for menu items using text and image data"""
    logger.info(f"🏗️  Generating embeddings for {len(df_menu)} menu items...")
    
    processed_df = df_menu.copy()
    vecs = []
    image_dir_path = Path(image_directory)
    
    for idx, row in processed_df.iterrows():
        # Create text embedding
        text = f"{row['name']} - {row['category_brief']} - {row['group_category']} - {row['description']}"
        t_vec = txt_model.encode(text)
        
        i_vec = np.zeros(512)  # Default zero vector
        # Process image
        try:
            specified_image_path = image_dir_path / str(row['image_path'])
            if specified_image_path.exists():
                img = Image.open(specified_image_path)
                img_tensor = clip_preprocess(img).unsqueeze(0)
                with torch.no_grad():
                    i_vec = clip_model.encode_image(img_tensor)[0].cpu().numpy()
                logger.info(f"📷 Using specified image: {row['image_path']}")
                
        except Exception as e:
            logger.warning(f"⚠️  Error processing image for {row['name']}: {e}")
            i_vec = np.zeros(512)

        # Concatenate text and image embeddings
        vecs.append(np.concatenate([t_vec, i_vec]))
    
    # Add vectors to dataframe
    processed_df["vector"] = vecs
    
    logger.success(f"✅ Generated embeddings for {len(processed_df)} menu items")
    return processed_df

def push_to_qdrant(restaurant_slug: str, df_with_embeddings: pd.DataFrame) -> bool:
    """Push restaurant embeddings to Qdrant"""
    collection_name = f"{restaurant_slug}_qdb"
    logger.info(f"📤 Pushing embeddings to Qdrant collection: {collection_name}")
    
    if len(df_with_embeddings) == 0:
        logger.info(f"⏭️  No items to upload to Qdrant")
        return True
    
    try:
        # Check if collection exists
        collections = qd.get_collections().collections
        collection_names = [col.name for col in collections]
        collection_exists = collection_name in collection_names
        
        if not collection_exists:
            logger.info(f"🆕 Creating new Qdrant collection: {collection_name}")
            from qdrant_client.models import VectorParams
            qd.create_collection(
                collection_name=collection_name,
                vectors_config=VectorParams(
                    size=1280, distance="Cosine"
                )
            )
            logger.success(f"✅ Created Qdrant collection: {collection_name}")
        else:
            logger.info(f"📋 Using existing Qdrant collection: {collection_name}")
        
        # Prepare points for upsert
        points = []
        from qdrant_client.models import PointStruct
        
        for idx, row in df_with_embeddings.iterrows():
            # Create minimal payload - only essential fields for search
            # Full details will be fetched from PostgreSQL using public_id
            payload = {
                'public_id': str(row['public_id']),
                'name': str(row['name']),
                'description': str(row['description']),
                'category_brief': str(row['category_brief']),  # Use category_brief as the main category
                'group_category': str(row['group_category']),
            }
            
            point = PointStruct(
                id=idx,  # Use pandas index as Qdrant point ID
                vector=row["vector"].tolist(),
                payload=payload
            )
            points.append(point)
        
        # Upsert points (this will add new points or update existing ones)
        qd.upsert(
            collection_name=collection_name,
            points=points
        )
        
        logger.success(f"✅ Uploaded {len(points)} embeddings to Qdrant collection: {collection_name}")
        return True
        
    except Exception as e:
        logger.error(f"❌ Error uploading to Qdrant: {e}")
        return False

# ---------- core loader -------------------------------------------------------

def seed_folder(folder: Path):
    logger.info(f"On‑boarding folder: {folder}")
    assert (folder / "meta.json").exists(), "meta.json missing"
    assert (folder / "tables.json").exists(), "tables.json missing"
    assert (folder / "menu.csv").exists(), "menu.csv missing"
    assert (folder / "images").exists(), "images directory missing"

    meta     = json.loads((folder / "meta.json").read_text())
    tbl_cfg  = json.loads((folder / "tables.json").read_text())
    hours_fp = folder / "hours.json"
    hours_cfg = json.loads(hours_fp.read_text()) if hours_fp.exists() else None

    df_menu  = pd.read_csv(folder / "menu.csv")
    logger.info(f"{len(df_menu)} menu rows loaded")

    # Validate and clean CSV format
    df_menu = validate_and_clean_csv(df_menu)

    # Always use images/ subfolder in the restaurant folder
    image_directory = str(folder / "images")
    logger.info(f"🖼️  Using images directory: {image_directory}")
    df_menu = process_image_urls_and_upload_to_cloudflare(df_menu, image_directory, meta["slug"])
    
    # Save the updated CSV with processed image paths (only expected columns)
    df_menu.to_csv(folder / "menu_processed.csv", index=False)
    logger.success(f"✅ Saved processed menu data to menu_processed.csv")

    with SessionLocal() as db:
        # ---- restaurant
        rest = db.query(Restaurant).filter_by(public_id=meta["public_id"]).first()
        if not rest:
            # Generate API key for new restaurant
            api_key = generate_api_key()
            
            # Ensure uniqueness across all restaurants
            while db.query(Restaurant).filter(Restaurant.api_key == api_key).first():
                api_key = generate_api_key()
            
            rest = Restaurant(
                public_id   = meta["public_id"],
                slug        = meta["slug"],
                name        = meta["restaurant_name"],
                tz          = meta["tz"],
                require_pass= tbl_cfg["pass_required"],
                api_key     = api_key
            )
            db.add(rest)
            db.flush()
            logger.success(f"Restaurant created id={rest.id}")
            logger.success(f"🔑 API Key generated: {api_key}")
            print(f"\n{'='*60}")
            print(f"🔑 ADMIN API KEY FOR {meta['restaurant_name'].upper()}")
            print(f"   Restaurant Slug: {meta['slug']}")
            print(f"   API Key: {api_key}")
            print(f"   Usage: Authorization: Bearer {api_key}")
            print(f"{'='*60}\n")
        else:
            logger.info(f"Restaurant already exists id={rest.id}")

        # ---- hours
        db.query(RestaurantHours).filter_by(restaurant_id=rest.id).delete()
        if hours_cfg:
            for h in hours_cfg:
                db.add(RestaurantHours(
                    public_id=new_id(),
                    restaurant_id=rest.id,
                    day=h["day"],
                    opens_at=datetime.strptime(h["opens_at"], "%H:%M").time(),
                    closes_at=datetime.strptime(h["closes_at"], "%H:%M").time()
                ))
        else:  # default 24 h
            db.add(RestaurantHours(
                public_id=new_id(),
                restaurant_id=rest.id,
                day=0,
                opens_at=time(0, 0),
                closes_at=time(23, 59)
            ))

        # ---- tables (only once)
        existing_tables = db.query(Table).filter_by(restaurant_id=rest.id).count()
        if existing_tables == 0:
            for n in range(1, tbl_cfg["number_of_tables"] + 1):
                db.add(Table(
                    public_id=new_id(),
                    restaurant_id=rest.id,
                    number=n,
                    qr_token=create_qr_token(rest.id, n)
                ))
            logger.success(f"Created {tbl_cfg['number_of_tables']} tables")
        else:
            logger.info(f"Tables already exist: {existing_tables} tables found")

        # ---- daily pass
        if tbl_cfg["pass_required"]:
            today = date.today()
            db.merge(DailyPass(
                restaurant_id=rest.id,
                public_id=new_id(),
                word_hash=hashlib.sha256((tbl_cfg["password"] or "").encode()).hexdigest(),
                valid_date=today
            ))
            logger.success("Daily pass configured")

        # ---- menu items
        menu_items_processed = 0
        # Generate unique public_ids for menu items if not present
        for idx, row in df_menu.iterrows():
            public_id_value = row.get('public_id')
            has_public_id = pd.notna(public_id_value) and str(public_id_value).strip() != ''
            if not has_public_id:
                df_menu.at[idx, 'public_id'] = new_id()

        # Generate embeddings for all menu items
        logger.info("🧠 Generating embeddings for menu items...")
        df_with_embeddings = generate_embeddings_for_menu_items(df_menu, image_directory)
        
        for idx, row in df_menu.iterrows():
            try:
                mi = db.query(MenuItem).filter_by(
                    restaurant_id=rest.id,
                    name=row["name"]
                ).first()
                if not mi:
                    mi = MenuItem(public_id=row.get("public_id") or new_id(),
                                  restaurant_id=rest.id)
                    db.add(mi)

                mi.name            = row["name"]
                mi.category_brief  = row["category_brief"]
                mi.group_category  = row["group_category"]
                mi.description     = row["description"]
                # Handle price conversion properly
                try:
                    if pd.notna(row["price"]) and row["price"] != "":
                        mi.price = float(row["price"])
                    else:
                        logger.warning(f"⚠️  Missing price for {row['name']}, setting to 0.0")
                        mi.price = 0.0
                except (ValueError, TypeError) as e:
                    logger.warning(f"⚠️  Invalid price for {row['name']}: {row['price']}, setting to 0.0")
                    mi.price = 0.0
                
                mi.image_path      = row["image_path"] if pd.notna(row["image_path"]) else None
                mi.cloudflare_image_id = row["cloudflare_image_id"] if pd.notna(row["cloudflare_image_id"]) else None
                mi.cloudflare_video_id = row["cloudflare_video_id"] if pd.notna(row["cloudflare_video_id"]) else None
                mi.veg_flag        = bool(row["veg_flag"]) if pd.notna(row["veg_flag"]) else False
                mi.is_bestseller   = bool(row["is_bestseller"]) if pd.notna(row["is_bestseller"]) else False
                mi.is_recommended  = bool(row["is_recommended"]) if pd.notna(row["is_recommended"]) else False
                mi.kind            = row["kind"] if pd.notna(row["kind"]) else "food"
                mi.priority        = int(row["priority"]) if pd.notna(row["priority"]) else 0
                mi.promote         = bool(row["promote"]) if pd.notna(row["promote"]) else False
                
                # Flush this individual item to catch any issues early
                db.flush()
                menu_items_processed += 1
                
            except Exception as e:
                logger.error(f"❌ Failed to process menu item {row['name']}: {e}")
                db.rollback()
                continue

        logger.success(f"✅ Processed {menu_items_processed} menu items in PostgreSQL")
        
        # Commit PostgreSQL changes before proceeding to Qdrant
        db.commit()
        logger.success("PostgreSQL seed complete ✔︎")

    # ---- Push embeddings to Qdrant
    logger.info("🔗 Pushing embeddings to Qdrant...")
    qdrant_success = push_to_qdrant(meta["slug"], df_with_embeddings)
    
    if qdrant_success:
        logger.success("Qdrant seed complete ✔︎")
    else:
        logger.error("❌ Qdrant seed failed")

    logger.success(f"🎉 On‑boarding finished for {meta['restaurant_name']}")

# ---------- cli ---------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python 1_onboard_restaurants.py /path/to/restaurant_folder")
        sys.exit(1)

    folder = Path(sys.argv[1]).expanduser().resolve()
    if not folder.is_dir():
        logger.error("Provided path is not a directory")
        sys.exit(1)

    try:
        seed_folder(folder)
    except Exception as e:
        logger.error(f"❌ Onboarding failed: {e}")
        sys.exit(1)

    # copy images to image_dir
    shutil.copytree(folder / "images", image_dir / folder.name, dirs_exist_ok=True)