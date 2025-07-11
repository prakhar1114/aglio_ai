#!/usr/bin/env python3
"""
Seed a single restaurant folder into Postgres and Qdrant.

Usage:
    python 1_onboard_restaurants.py /path/to/restaurant_folder
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
from models.schema import (
    Restaurant, RestaurantHours, Table, DailyPass, MenuItem,
    POSSystem, Variation, AddonGroup, AddonGroupItem, ItemVariation, ItemAddon, ItemVariationAddon
)
from config import image_dir, qd

# Import POS onboarding utilities
from pos_onboarding.petpooja import process_petpooja_data, create_item_relationships
from pos_onboarding.petpooja_dinein import (
    process_dinein_tables_from_areas, create_dummy_variations_for_dinein_items,
    create_pos_system_for_dinein, process_dinein_addon_groups, create_dinein_item_relationships
)

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
        'is_recommended', 'kind', 'priority', 'promote', 'public_id',
        'cloudflare_image_id', 'cloudflare_video_id', 'external_id'
    ]
    
    # Check for required columns, ALWAYS ADD THESE, DO NOT REMOVE ANY
    required_columns = ['name', 'category_brief', 'group_category', 'description', 'price', 'image_path', 'cloudflare_image_id', 'cloudflare_video_id', 'external_id', 'veg_flag', 'is_bestseller', 'is_recommended', 'promote', 'priority', 'kind']
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
            # elif col in ['veg_flag', 'is_bestseller', 'is_recommended', 'promote']:
            #     df_cleaned[col] = False
            # elif col == 'priority':
            #     df_cleaned[col] = 0
            # elif col == 'kind':
            #     df_cleaned[col] = 'food'
            # elif col in ['image_path', 'cloudflare_image_id', 'cloudflare_video_id', 'external_id']:
            #     df_cleaned[col] = None
    
    logger.info(f"📋 CSV validated and cleaned: {len(df_cleaned)} rows, {len(available_columns)} columns")
    return df_cleaned

def process_image_urls_and_upload_to_cloudflare(df_menu: pd.DataFrame, image_directory: str, restaurant_slug: str) -> pd.DataFrame:
    """Process image_path URLs, download them, and upload to Cloudflare"""
    logger.info(f"📷 Processing image URLs and uploading to Cloudflare, target directory: {image_directory}")
    
    # Ensure image directory exists
    os.makedirs(image_directory, exist_ok=True)
    
    processed_df = df_menu.copy()
    
    # Initialize Cloudflare columns only if they don't already exist
    if 'cloudflare_image_id' not in processed_df.columns:
        processed_df['cloudflare_image_id'] = None
    if 'cloudflare_video_id' not in processed_df.columns:
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
        
        # Upload to Cloudflare only if we have a local file AND no existing Cloudflare IDs
        cf_img_id = row.get('cloudflare_image_id')
        cf_vid_id = row.get('cloudflare_video_id')
        has_local_file = local_file_path and Path(local_file_path).exists()
        img_id_empty = pd.isna(cf_img_id) if cf_img_id is not None else True
        vid_id_empty = pd.isna(cf_vid_id) if cf_vid_id is not None else True
        should_upload = has_local_file and img_id_empty and vid_id_empty
        if should_upload:
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
        else:
            logger.info(f"⏭️  Skipping Cloudflare upload for {row['name']} (no local file or already has Cloudflare IDs)")
    
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
            image_path_val = row.get('image_path')
            has_image = image_path_val is not None and pd.notna(image_path_val)
            if has_image:
                specified_image_path = image_dir_path / str(image_path_val)
                if specified_image_path.exists():
                    img = Image.open(specified_image_path)
                    # Convert PIL Image to tensor properly
                    img_preprocessed = clip_preprocess(img)
                    img_tensor = img_preprocessed.unsqueeze(0) if hasattr(img_preprocessed, 'unsqueeze') else torch.tensor(img_preprocessed).unsqueeze(0)
                    with torch.no_grad():
                        i_vec = clip_model.encode_image(img_tensor)[0].cpu().numpy()
                    logger.info(f"📷 Using specified image: {image_path_val}")
                
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
        
        if collection_exists:
            logger.info(f"🗑️ Deleting existing Qdrant collection: {collection_name}")
            qd.delete_collection(collection_name=collection_name)
            logger.success(f"✅ Deleted Qdrant collection: {collection_name}")
        
        logger.info(f"🆕 Creating new Qdrant collection: {collection_name}")
        from qdrant_client.models import VectorParams, Distance
        qd.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=1280, distance=Distance.COSINE
            )
        )
        logger.success(f"✅ Created Qdrant collection: {collection_name}")
        
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
            
            # Convert pandas index to proper integer for Qdrant
            point_id = hash(str(idx)) % (10**9)  # Ensure it's a valid integer ID
            point = PointStruct(
                id=point_id,
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
    logger.info(f"On-boarding folder: {folder}")

    # ------------------------------------------------------------------
    # Validate required files (POS vs Non-POS have different expectations)
    # ------------------------------------------------------------------

    assert (folder / "meta.json").exists(), "meta.json missing"
    meta = json.loads((folder / "meta.json").read_text())

    has_pos_config = bool(meta.get("pos_config") and meta["pos_config"].get("pos_type"))
    pos_type = meta["pos_config"].get("pos_type") if has_pos_config else None
    is_dinein = pos_type == "petpooja_dinein"

    tbl_cfg = None
    # tables.json not required for petpooja_dinein since tables come from areas.json
    if not is_dinein:
        assert (folder / "tables.json").exists(), "tables.json missing"
        tbl_cfg = json.loads((folder / "tables.json").read_text())
    assert (folder / "menu.csv").exists(), "menu.csv missing"
    if has_pos_config:
        # POS restaurants must supply additional raw menu data
        assert (folder / "menu.json").exists(), "menu.json missing for POS onboarding"
        if is_dinein:
            # Dine-in requires areas.json for table management
            assert (folder / "areas.json").exists(), "areas.json missing for petpooja_dinein"
    assert (folder / "images").exists(), "images directory missing"

    hours_fp = folder / "hours.json"
    hours_cfg = json.loads(hours_fp.read_text()) if hours_fp.exists() else None

    # Load menu assets
    df_menu = pd.read_csv(folder / "menu.csv")
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

    # --------------------------------------------------------------
    # If POS integration is present, load menu.json and areas.json for downstream use
    # --------------------------------------------------------------

    menu_api_data = None
    areas_data = None
    petpooja_items_map = {}
    attributes_map = {}
    if has_pos_config:
        menu_api_data = json.loads((folder / "menu.json").read_text())
        if pos_type == "petpooja":
            petpooja_items_map = {item["itemid"]: item for item in menu_api_data.get("items", [])}
            attributes_map = {attr["attributeid"]: attr["attribute"] for attr in menu_api_data.get("attributes", [])}
        elif is_dinein:
            # Load areas data for dine-in
            areas_data = json.loads((folder / "areas.json").read_text())
            petpooja_items_map = {item["itemid"]: item for item in menu_api_data.get("items", [])}
            attributes_map = {attr["attributeid"]: attr["attribute"] for attr in menu_api_data.get("attributes", [])}

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
                require_pass= tbl_cfg["pass_required"] if tbl_cfg else False,  # Default to False for dine-in
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

        # ---- tables (updated for dine-in)
        existing_tables = db.query(Table).filter_by(restaurant_id=rest.id).count()
        if existing_tables == 0:
            if is_dinein and areas_data:
                # Use areas.json for dine-in table creation
                process_dinein_tables_from_areas(areas_data, rest.id, db)
            elif tbl_cfg:
                # Use traditional table creation for regular restaurants
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

        # ---- daily pass (only for non-dine-in restaurants)
        if tbl_cfg and tbl_cfg["pass_required"]:
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
                    name=str(row["name"])
                ).first()
                if not mi:
                    mi = MenuItem(
                        public_id=str(row.get("public_id")) or new_id(),
                        restaurant_id=rest.id
                    )
                    db.add(mi)

                # Set core fields from CSV
                mi.name = str(row["name"])
                mi.category_brief = str(row["category_brief"]) if pd.notna(row["category_brief"]) else ""
                mi.group_category = str(row["group_category"]) if pd.notna(row["group_category"]) else ""
                mi.description = str(row["description"]) if pd.notna(row["description"]) else ""
                
                # Handle price conversion properly
                try:
                    price_val = row["price"]
                    if pd.notna(price_val) and str(price_val).strip():
                        mi.price = float(price_val)
                    else:
                        logger.warning(f"⚠️  Missing price for {row['name']}, setting to 0.0")
                        mi.price = 0.0
                except (ValueError, TypeError) as e:
                    logger.warning(f"⚠️  Invalid price for {row['name']}: {row['price']}, setting to 0.0")
                    mi.price = 0.0
                
                # Set image and cloudflare fields
                mi.image_path = str(row["image_path"]) if pd.notna(row["image_path"]) and str(row["image_path"]).strip() else None
                mi.cloudflare_image_id = str(row["cloudflare_image_id"]) if pd.notna(row["cloudflare_image_id"]) and str(row["cloudflare_image_id"]).strip() else None
                mi.cloudflare_video_id = str(row["cloudflare_video_id"]) if pd.notna(row["cloudflare_video_id"]) and str(row["cloudflare_video_id"]).strip() else None
                
                # Set boolean and other fields
                veg_val = row.get("veg_flag")
                mi.veg_flag = bool(veg_val) if pd.notna(veg_val) else False
                
                bestseller_val = row.get("is_bestseller")
                mi.is_bestseller = bool(bestseller_val) if pd.notna(bestseller_val) else False
                
                recommended_val = row.get("is_recommended")
                mi.is_recommended = bool(recommended_val) if pd.notna(recommended_val) else False
                
                kind_val = row.get("kind")
                mi.kind = str(kind_val) if pd.notna(kind_val) else "food"
                
                priority_val = row.get("priority")
                mi.priority = int(priority_val) if pd.notna(priority_val) else 0
                
                promote_val = row.get("promote")
                mi.promote = bool(promote_val) if pd.notna(promote_val) else False
                
                # Set new schema fields with defaults for simple restaurants
                external_id_val = row.get("external_id")
                mi.external_id = str(external_id_val) if pd.notna(external_id_val) and str(external_id_val).strip() else None
                mi.external_data = None  # No external data for simple restaurants
                mi.itemallowvariation = False  # Simple restaurants don't have variations
                mi.itemallowaddon = False  # Simple restaurants don't have addons
                mi.pos_system_id = None  # No POS system integration
                mi.tags = []  # Empty tags list
                
                # Add POS-specific basic fields (external_id, flags) if applicable
                if menu_api_data:
                    if mi.external_id and mi.external_id in petpooja_items_map:
                        p_item = petpooja_items_map[mi.external_id]
                        mi.itemallowvariation = p_item.get("itemallowvariation", "0") == "1"
                        mi.itemallowaddon = p_item.get("itemallowaddon", "0") == "1"
                        mi.external_data = p_item
                        # basic tag enrichment
                        tags_list = p_item.get("item_tags", []).copy()
                        attr_id_val = p_item.get("item_attributeid")
                        
                        if attr_id_val and attr_id_val in attributes_map:
                            tags_list.append(attributes_map[attr_id_val])
                        mi.tags = tags_list
                
                # Flush this individual item to catch any issues early
                db.flush()
                menu_items_processed += 1
                
            except Exception as e:
                logger.error(f"❌ Failed to process menu item {row['name']}: {e}")
                db.rollback()
                continue

        logger.success(f"✅ Processed {menu_items_processed} menu items in PostgreSQL")
        
        # ---- POS-specific post-processing ----------------------------------
        if menu_api_data:
            if is_dinein:
                logger.info("🏢 Processing PetPooja dine-in data...")
                # Create POS system for dine-in
                pos_system = create_pos_system_for_dinein(
                    rest.id, meta.get("pos_config"), menu_api_data, areas_data, db
                )
                
                # Create dummy variations from item data
                created_variations = create_dummy_variations_for_dinein_items(
                    menu_api_data, pos_system.id, db
                )
                
                # Process addon groups using utility function
                addon_groups_synced, addon_items_synced = process_dinein_addon_groups(
                    menu_api_data, pos_system.id, attributes_map, db
                )
                
                logger.success(f"✅ Processed {addon_groups_synced} addon groups, {addon_items_synced} addon items for dine-in")
                
                # Update menu items with POS system reference
                logger.info("🔗 Updating menu items with POS system reference...")
                db.query(MenuItem).filter(
                    MenuItem.restaurant_id == rest.id,
                    MenuItem.external_id.isnot(None)
                ).update({"pos_system_id": pos_system.id})
                
                # Create item relationships with dummy variations
                create_dinein_item_relationships(df_menu, menu_api_data, rest.id, pos_system.id, created_variations, db)
                
            else:
                # Regular PetPooja delivery processing
                logger.info("🔗 Processing PetPooja data...")
                petpooja_result = process_petpooja_data(menu_api_data, rest.id, meta.get("pos_config"), db)
                if petpooja_result.get("success"):
                    logger.info("🔗 Updating menu items with POS system reference...")
                    db.query(MenuItem).filter(
                        MenuItem.restaurant_id == rest.id,
                        MenuItem.external_id.isnot(None)
                    ).update({"pos_system_id": petpooja_result["pos_system_id"]})
                    create_item_relationships(df_menu, menu_api_data, rest.id, petpooja_result["pos_system_id"], db)

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

    logger.success(f"🎉 On-boarding finished for {meta['restaurant_name']}")

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
    logger.success(f"✅ Copied images to {image_dir / folder.name}")