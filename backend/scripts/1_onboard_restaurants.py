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
import requests
from io import BytesIO
from sentence_transformers import SentenceTransformer
from PIL import Image
from loguru import logger
import pickle
from rank_bm25 import BM25Okapi

# Add parent directory to path to import config and models
sys.path.append(str(Path(__file__).parent.parent))
from models.schema import SessionLocal
from common.utils import download_instagram_content, download_url_content, download_google_drive_content, is_url, is_instagram_url, is_google_drive_url
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
        'cloudflare_image_id', 'cloudflare_video_id', 'id', 'show_on_menu', "timing_start", "timing_end", "tags"
    ]
    
    # Check for required columns, ALWAYS ADD THESE, DO NOT REMOVE ANY
    required_columns = ['name', 'category_brief', 'group_category', 'description', 'price', 'image_path', 'cloudflare_image_id', 'cloudflare_video_id', 'id', 'veg_flag', 'is_bestseller', 'is_recommended', 'promote', 'priority', 'kind']
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
            elif col == 'show_on_menu':
                df_cleaned[col] = True
    
    # Validate that all rows have non-null IDs
    id_series = df_cleaned['id'].tolist()
    null_id_indices = [i for i, val in enumerate(id_series) if pd.isnull(val)]
    if null_id_indices:
        raise ValueError(f"Missing ID values in rows (0-based index): {null_id_indices}")
    
    # Validate that all IDs are unique
    non_null_ids = [str(x) for x in id_series if not pd.isnull(x)]
    duplicate_ids = [x for x in set(non_null_ids) if non_null_ids.count(x) > 1]
    if duplicate_ids:
        raise ValueError(f"Duplicate IDs found: {duplicate_ids}")
    
    logger.info(f"📋 CSV validated and cleaned: {len(df_cleaned)} rows, {len(available_columns)} columns")
    return df_cleaned

def process_image_urls_and_upload_to_cloudflare(df_menu: pd.DataFrame, image_directory: str, restaurant_slug: str) -> pd.DataFrame:
    """Process image_path URLs, download them, and upload to Cloudflare"""
    logger.info(f"📷 Processing image URLs and uploading to Cloudflare, target directory: {image_directory}")
    
    # Ensure image directory exists
    os.makedirs(image_directory, exist_ok=True)
    
    processed_df = df_menu.copy()
    
    # # Initialize Cloudflare columns only if they don't already exist
    # if 'cloudflare_image_id' not in processed_df.columns:
    #     processed_df['cloudflare_image_id'] = None
    # if 'cloudflare_video_id' not in processed_df.columns:
    #     processed_df['cloudflare_video_id'] = None
    
    for idx, row in processed_df.iterrows():
        image_path_value = row.get('image_path')
        cloudflare_image_id = row.get('cloudflare_image_id')
        cloudflare_video_id = row.get('cloudflare_video_id')

        if pd.notna(cloudflare_image_id) or pd.notna(cloudflare_video_id):
            continue
        
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
                elif is_google_drive_url(image_url):
                    # Handle Google Drive URLs
                    logger.info(f"☁️  Downloading Google Drive content for {row['name']}")
                    downloaded_path, content_type, success = download_google_drive_content(
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
    """Generate embeddings for menu items using text, image, and video thumbnail data"""
    logger.info(f"🏗️  Generating embeddings for {len(df_menu)} menu items...")
    
    processed_df = df_menu.copy()
    vecs = []
    image_dir_path = Path(image_directory)
    
    for idx, row in processed_df.iterrows():
        # Create text embedding
        text = f"{row['name']} - {row['category_brief']} - {row['group_category']} - {row['description']}"
        t_vec = txt_model.encode(text)
        
        i_vec = np.zeros(512)  # Default zero vector
        
        # Process image or video thumbnail
        try:
            # First, try to process local image
            image_path_val = row.get('image_path')
            has_image = image_path_val is not None and pd.notna(image_path_val) and pd.notna(row.get('cloudflare_image_id'))
            if has_image:
                specified_image_path = image_dir_path / str(image_path_val)
                if specified_image_path.exists():
                    img = Image.open(specified_image_path)
                    # Convert PIL Image to tensor properly
                    img_preprocessed = clip_preprocess(img)
                    # Ensure proper tensor conversion
                    if isinstance(img_preprocessed, torch.Tensor):
                        img_tensor = img_preprocessed.unsqueeze(0)
                    else:
                        img_tensor = torch.tensor(img_preprocessed).unsqueeze(0)
                    with torch.no_grad():
                        i_vec = clip_model.encode_image(img_tensor)[0].cpu().numpy()
                    logger.info(f"📷 Using specified image: {image_path_val}")
            
            # If no local image, try to get video thumbnail from Cloudflare
            elif pd.notna(row.get('cloudflare_video_id')):
                video_id_val = row.get('cloudflare_video_id')
                has_video = video_id_val is not None and pd.notna(video_id_val) and str(video_id_val).strip()
                if has_video:
                    video_id = str(video_id_val).strip()
                    # Generate Cloudflare Stream thumbnail URL
                    # Using the standard videodelivery.net domain for Cloudflare Stream
                    thumbnail_url = f"https://videodelivery.net/{video_id}/thumbnails/thumbnail.jpg?time=1s&height=480"
                    
                    try:
                        # Download thumbnail image
                        response = requests.get(thumbnail_url, timeout=10)
                        if response.status_code == 200:
                            img = Image.open(BytesIO(response.content))
                            # Convert PIL Image to tensor properly
                            img_preprocessed = clip_preprocess(img)
                            # Ensure proper tensor conversion
                            if isinstance(img_preprocessed, torch.Tensor):
                                img_tensor = img_preprocessed.unsqueeze(0)
                            else:
                                img_tensor = torch.tensor(img_preprocessed).unsqueeze(0)
                            with torch.no_grad():
                                i_vec = clip_model.encode_image(img_tensor)[0].cpu().numpy()
                            logger.info(f"🎬 Using video thumbnail for: {row['name']} (video ID: {video_id})")
                        else:
                            logger.warning(f"⚠️  Failed to fetch video thumbnail for {row['name']}: HTTP {response.status_code}")
                    except Exception as video_error:
                        logger.warning(f"⚠️  Error processing video thumbnail for {row['name']}: {video_error}")
                
        except Exception as e:
            logger.warning(f"⚠️  Error processing media for {row['name']}: {e}")
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

# ---------- helpers -----------------------------------------------------------

def safe_read_csv(csv_path: Path):
    """Return DataFrame if file exists, else None."""
    if csv_path.exists():
        return pd.read_csv(csv_path)
    return None

def clean_row_for_json(row):
    """Clean pandas row data for JSON serialization by replacing NaN with None."""
    cleaned = {}
    for key, value in row.items():
        if pd.isna(value):
            cleaned[key] = None
        else:
            cleaned[key] = value
    return cleaned

# -----------------------------------------------------------------------------
# No-POS onboarding helper
# -----------------------------------------------------------------------------

def onboard_no_pos(folder: Path, db, restaurant_id: int, df_menu: pd.DataFrame, rest, logger):
    """Process customisation CSVs for pos_type==no_pos."""

    custom_dir = folder / "customisations"

    # 1. Ensure POSSystem row exists
    pos_system = db.query(POSSystem).filter_by(restaurant_id=restaurant_id, name="no_pos").first()
    if not pos_system:
        pos_system = POSSystem(
            restaurant_id=restaurant_id,
            name="no_pos",
            config={"type": "manual"},
            is_active=True,
        )
        db.add(pos_system)
        db.flush()

    # 2. Load CSVs (skip silently if directory / file missing)
    variations_df = safe_read_csv(custom_dir / "variations.csv")
    addon_groups_df = safe_read_csv(custom_dir / "addon_groups.csv")
    addon_items_df = safe_read_csv(custom_dir / "addon_items.csv")
    item_variations_df = safe_read_csv(custom_dir / "item_variations.csv")
    item_addons_df = safe_read_csv(custom_dir / "item_addons.csv")
    item_variation_addons_df = safe_read_csv(custom_dir / "item_variation_addons.csv")

    # Build lookup for menu items via external_id (id column of menu.csv)
    menu_items = db.query(MenuItem).filter(MenuItem.restaurant_id == restaurant_id).all()
    menu_item_map = {mi.external_id: mi for mi in menu_items}

    # 3. Insert Variations
    variation_map = {}
    if variations_df is not None:
        for _, row in variations_df.iterrows():
            if pd.isna(row.get("id")):
                raise ValueError("variations.csv missing 'id' value in one of the rows")

            var_ext_id = str(row["id"]).strip()
            # Skip if already exists (idempotent)
            existing = db.query(Variation).filter_by(external_variation_id=var_ext_id, pos_system_id=pos_system.id).first()
            if existing:
                variation_map[var_ext_id] = existing
                continue

            variation = Variation(
                name=str(row["name"]),
                display_name=str(row["display_name"]),
                group_name=str(row["group_name"]),
                is_active=str(row["is_active"]).lower().strip() in ["1", "true", "yes"],
                external_variation_id=var_ext_id,
                external_data=clean_row_for_json(row),
                pos_system_id=pos_system.id,
            )
            db.add(variation)
            db.flush()
            variation_map[var_ext_id] = variation

    # 4. Insert Addon Groups
    addon_group_map = {}
    if addon_groups_df is not None:
        for _, row in addon_groups_df.iterrows():
            if pd.isna(row.get("id")):
                raise ValueError("addon_groups.csv missing 'id' value in one of the rows")
            ag_ext_id = str(row["id"]).strip()
            existing = db.query(AddonGroup).filter_by(external_group_id=ag_ext_id, pos_system_id=pos_system.id).first()
            if existing:
                addon_group_map[ag_ext_id] = existing
                continue

            addon_group = AddonGroup(
                name=str(row["name"]),
                display_name=str(row["display_name"]),
                priority=int(row.get("priority", 0) or 0),
                is_active=str(row.get("is_active", "true")).lower().strip() in ["1", "true", "yes"],
                external_group_id=ag_ext_id,
                external_data=clean_row_for_json(row),
                pos_system_id=pos_system.id,
            )
            db.add(addon_group)
            db.flush()
            addon_group_map[ag_ext_id] = addon_group

    # 5. Insert Addon Items
    if addon_items_df is not None:
        for _, row in addon_items_df.iterrows():
            grp_id = str(row["addon_group_id"]).strip()
            if grp_id not in addon_group_map:
                raise ValueError(f"addon_items.csv references unknown addon_group_id '{grp_id}'")

            if pd.isna(row.get("id")):
                raise ValueError("addon_items.csv missing 'id' value in one of the rows")
            ai_ext_id = str(row["id"]).strip()

            existing = db.query(AddonGroupItem).filter_by(
                external_addon_id=ai_ext_id, addon_group_id=addon_group_map[grp_id].id
            ).first()
            if existing:
                continue

            tags_raw = row.get("tags", "")
            if tags_raw is None or (hasattr(tags_raw, '__bool__') and not tags_raw) or pd.isna(tags_raw):
                tags = []
            else:
                tags_raw = str(tags_raw).strip()
                tags = [t.strip() for t in tags_raw.split(",") if t.strip()] if tags_raw else []

            addon_item = AddonGroupItem(
                addon_group_id=addon_group_map[grp_id].id,
                name=str(row["name"]),
                display_name=str(row["display_name"]),
                price=float(row["price"]),
                is_active=str(row.get("is_active", "true")).lower().strip() in ["1", "true", "yes"],
                priority=int(row.get("priority", 0) or 0),
                tags=tags,
                external_addon_id=ai_ext_id,
                external_data=clean_row_for_json(row),
            )
            db.add(addon_item)

    # 6. Insert Item Variations
    item_variation_map = {}
    # First, check which item variations have addons (for variationallowaddon flag)
    item_variations_with_addons = set()
    if item_variation_addons_df is not None:
        item_variations_with_addons = set(
            str(row["item_variation_id"]).strip() 
            for _, row in item_variation_addons_df.iterrows() 
            if not pd.isna(row.get("item_variation_id"))
        )
    
    if item_variations_df is not None:
        for _, row in item_variations_df.iterrows():
            # Mandatory columns check
            required_cols = ["id", "menu_item_id", "variation_id", "price"]
            for col in required_cols:
                if pd.isna(row.get(col)):
                    raise ValueError(f"item_variations.csv missing '{col}' in one of the rows")

            menu_item_key = str(row["menu_item_id"]).strip()
            variation_key = str(row["variation_id"]).strip()
            item_var_ext_id = str(row["id"]).strip()

            if menu_item_key not in menu_item_map:
                raise ValueError(f"item_variations.csv references unknown menu_item_id '{menu_item_key}'")
            if variation_key not in variation_map:
                raise ValueError(f"item_variations.csv references unknown variation_id '{variation_key}'")

            menu_item = menu_item_map[menu_item_key]
            variation = variation_map[variation_key]

            # Check if this item variation has addons
            has_addons = item_var_ext_id in item_variations_with_addons

            # Check if ItemVariation already exists
            existing_item_variation = db.query(ItemVariation).filter_by(
                menu_item_id=menu_item.id,
                variation_id=variation.id,
                external_id=item_var_ext_id
            ).first()

            if existing_item_variation:
                # Update existing record
                existing_item_variation.price = float(row["price"])
                existing_item_variation.is_active = str(row.get("is_active", "true")).lower().strip() in ["1", "true", "yes"]
                existing_item_variation.priority = int(row.get("priority", 0) or 0)
                existing_item_variation.variationallowaddon = has_addons
                existing_item_variation.external_data = clean_row_for_json(row)
                item_variation_map[item_var_ext_id] = existing_item_variation
            else:
                # Create new record
                item_variation = ItemVariation(
                    menu_item_id=menu_item.id,
                    variation_id=variation.id,
                    price=float(row["price"]),
                    is_active=str(row.get("is_active", "true")).lower().strip() in ["1", "true", "yes"],
                    priority=int(row.get("priority", 0) or 0),
                    variationallowaddon=has_addons,
                    external_id=item_var_ext_id,
                    external_data=clean_row_for_json(row),
                )
                db.add(item_variation)
                db.flush()
                item_variation_map[item_var_ext_id] = item_variation

    # 7. Insert Item Addons
    if item_addons_df is not None:
        for _, row in item_addons_df.iterrows():
            required_cols = ["menu_item_id", "addon_group_id", "min_selection", "max_selection"]
            for col in required_cols:
                if pd.isna(row.get(col)):
                    raise ValueError(f"item_addons.csv missing '{col}' in one of the rows")

            menu_item_key = str(row["menu_item_id"]).strip()
            addon_group_key = str(row["addon_group_id"]).strip()

            if menu_item_key not in menu_item_map:
                raise ValueError(f"item_addons.csv references unknown menu_item_id '{menu_item_key}'")
            if addon_group_key not in addon_group_map:
                raise ValueError(f"item_addons.csv references unknown addon_group_id '{addon_group_key}'")

            menu_item = menu_item_map[menu_item_key]
            addon_group = addon_group_map[addon_group_key]

            # Check if ItemAddon already exists
            existing_item_addon = db.query(ItemAddon).filter_by(
                menu_item_id=menu_item.id,
                addon_group_id=addon_group.id
            ).first()

            if existing_item_addon:
                # Update existing record
                existing_item_addon.min_selection = int(row["min_selection"])
                existing_item_addon.max_selection = int(row["max_selection"])
                existing_item_addon.is_active = str(row.get("is_active", "true")).lower().strip() in ["1", "true", "yes"]
                existing_item_addon.priority = int(row.get("priority", 0) or 0)
            else:
                # Create new record
                item_addon = ItemAddon(
                    menu_item_id=menu_item.id,
                    addon_group_id=addon_group.id,
                    min_selection=int(row["min_selection"]),
                    max_selection=int(row["max_selection"]),
                    is_active=str(row.get("is_active", "true")).lower().strip() in ["1", "true", "yes"],
                    priority=int(row.get("priority", 0) or 0),
                )
                db.add(item_addon)

    # 8. Insert ItemVariation Addons
    if item_variation_addons_df is not None:
        for _, row in item_variation_addons_df.iterrows():
            required_cols = ["item_variation_id", "addon_group_id", "min_selection", "max_selection"]
            for col in required_cols:
                if pd.isna(row.get(col)):
                    raise ValueError(f"item_variation_addons.csv missing '{col}' in one of the rows")

            item_var_key = str(row["item_variation_id"]).strip()
            addon_group_key = str(row["addon_group_id"]).strip()

            if item_var_key not in item_variation_map:
                raise ValueError(f"item_variation_addons.csv references unknown item_variation_id '{item_var_key}'")
            if addon_group_key not in addon_group_map:
                raise ValueError(f"item_variation_addons.csv references unknown addon_group_id '{addon_group_key}'")

            item_variation = item_variation_map[item_var_key]
            addon_group = addon_group_map[addon_group_key]

            # Check if ItemVariationAddon already exists
            existing_item_var_addon = db.query(ItemVariationAddon).filter_by(
                item_variation_id=item_variation.id,
                addon_group_id=addon_group.id
            ).first()

            if existing_item_var_addon:
                # Update existing record
                existing_item_var_addon.min_selection = int(row["min_selection"])
                existing_item_var_addon.max_selection = int(row["max_selection"])
                existing_item_var_addon.is_active = str(row.get("is_active", "true")).lower().strip() in ["1", "true", "yes"]
                existing_item_var_addon.priority = int(row.get("priority", 0) or 0)
            else:
                # Create new record
                item_var_addon = ItemVariationAddon(
                    item_variation_id=item_variation.id,
                    addon_group_id=addon_group.id,
                    min_selection=int(row["min_selection"]),
                    max_selection=int(row["max_selection"]),
                    is_active=str(row.get("is_active", "true")).lower().strip() in ["1", "true", "yes"],
                    priority=int(row.get("priority", 0) or 0),
                )
                db.add(item_var_addon)

    # 9. Update Menu Item flags
    # items with variations
    db.query(MenuItem).filter(
        MenuItem.restaurant_id == restaurant_id,
        MenuItem.item_variations.any()
    ).update({"itemallowvariation": True}, synchronize_session=False)

    # items with addons
    db.query(MenuItem).filter(
        MenuItem.restaurant_id == restaurant_id,
        MenuItem.item_addons.any()
    ).update({"itemallowaddon": True}, synchronize_session=False)

    logger.success("✅ no_pos customisations processed")

# -----------------------------------------------------------------------------

# ---------- core loader -------------------------------------------------------

def seed_folder(folder: Path):
    logger.info(f"On-boarding folder: {folder}")
    
    # Keep track of created resources for rollback
    created_qdrant_collection = None
    restaurant_id = None

    try:
        # ------------------------------------------------------------------
        # Validate required files (POS vs Non-POS have different expectations)
        # ------------------------------------------------------------------

        assert (folder / "meta.json").exists(), "meta.json missing"
        meta = json.loads((folder / "meta.json").read_text())

        has_pos_config = bool(meta.get("pos_config") and meta["pos_config"].get("pos_type"))
        pos_type = meta["pos_config"].get("pos_type") if has_pos_config else None


        is_ppdinein = pos_type == "petpooja_dinein"
        is_no_pos = pos_type == "no_pos"
        is_ppdelivery = pos_type == "petpooja"

        # tables.json not required for petpooja_dinein since tables come from areas.json
        if is_ppdinein:
            assert (folder / "menu.csv").exists(), "menu.csv missing"
            assert (folder / "areas.json").exists(), "areas.json missing"
            assert (folder / "menu.json").exists(), "menu.json missing"
            assert (folder / "images").exists(), "images directory missing"
            tbl_cfg = None

        elif is_no_pos:
            assert (folder / "menu.csv").exists(), "menu.csv missing"
            assert (folder / "customisations").exists(), "customisations directory missing"
            assert (folder / "images").exists(), "images directory missing"
            assert (folder / "tables.json").exists(), "tables.json missing"
            tbl_cfg = json.loads((folder / "tables.json").read_text())

        elif is_ppdelivery:
            assert (folder / "menu.csv").exists(), "menu.csv missing"
            assert (folder / "menu.json").exists(), "menu.json missing"
            assert (folder / "images").exists(), "images directory missing"
            assert (folder / "tables.json").exists(), "tables.json missing"
            tbl_cfg = json.loads((folder / "tables.json").read_text())

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
        df_menu.to_csv(folder / "menu.csv", index=False) # to add cloudflare ids

        # --------------------------------------------------------------
        # If POS integration is present, load menu.json and areas.json for downstream use
        # --------------------------------------------------------------

        menu_api_data: dict | None = None
        areas_data: dict | None = None
        petpooja_items_map: dict = {}
        attributes_map: dict = {}

        # Only PetPooja variants require raw menu.json (delivery or dine-in)
        if is_ppdelivery or is_ppdinein:
            menu_api_path = folder / "menu.json"
            if not menu_api_path.exists():
                raise FileNotFoundError("menu.json missing but required for PetPooja onboarding")

            menu_api_data = json.loads(menu_api_path.read_text())
            # Common maps for both PP flows
            petpooja_items_map = {item["itemid"]: item for item in menu_api_data.get("items", [])}
            attributes_map = {attr["attributeid"]: attr["attribute"] for attr in menu_api_data.get("attributes", [])}

            if is_ppdinein:
                # Dine-in additionally needs areas.json
                areas_path = folder / "areas.json"
                if not areas_path.exists():
                    raise FileNotFoundError("areas.json missing for petpooja_dinein onboarding")
                areas_data = json.loads(areas_path.read_text())
         
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

            # DON'T commit here - save transaction until everything succeeds
            # Get the actual integer ID for use in function calls  
            restaurant_id = rest.id

            # ---- hours
            db.query(RestaurantHours).filter_by(restaurant_id=restaurant_id).delete()
            if hours_cfg:
                for h in hours_cfg:
                    db.add(RestaurantHours(
                        public_id=new_id(),
                        restaurant_id=restaurant_id,
                        day=h["day"],
                        opens_at=datetime.strptime(h["opens_at"], "%H:%M").time(),
                        closes_at=datetime.strptime(h["closes_at"], "%H:%M").time()
                    ))
            else:  # default 24 h
                db.add(RestaurantHours(
                    public_id=new_id(),
                    restaurant_id=restaurant_id,
                    day=0,
                    opens_at=time(0, 0),
                    closes_at=time(23, 59)
                ))

            # ---- tables (updated for dine-in)
            existing_tables = db.query(Table).filter_by(restaurant_id=restaurant_id).count()
            if existing_tables == 0:
                if is_ppdinein and areas_data:
                    # Use areas.json for dine-in table creation
                    process_dinein_tables_from_areas(areas_data, restaurant_id, db)
                elif tbl_cfg:
                    # Use traditional table creation for regular restaurants
                    for n in range(1, tbl_cfg["number_of_tables"] + 1):
                        db.add(Table(
                            public_id=new_id(),
                            restaurant_id=restaurant_id,
                            number=n,
                            qr_token=create_qr_token(restaurant_id, n)
                        ))
                    logger.success(f"Created {tbl_cfg['number_of_tables']} tables")
            else:
                logger.info(f"Tables already exist: {existing_tables} tables found")

            # ---- daily pass (only for non-dine-in restaurants)
            if tbl_cfg and tbl_cfg["pass_required"]:
                today = date.today()
                db.merge(DailyPass(
                    restaurant_id=restaurant_id,
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
                    mi = db.query(MenuItem).filter_by(
                        restaurant_id=restaurant_id,
                        external_id=str(row["id"])
                    ).first()
                    if mi:
                        df_menu.at[idx, 'public_id'] = mi.public_id
                    else:
                        df_menu.at[idx, 'public_id'] = new_id()

            # Generate embeddings for all menu items
            logger.info("🧠 Generating embeddings for menu items...")
            df_with_embeddings = generate_embeddings_for_menu_items(df_menu, image_directory)

            # --- BM25 Index Build & Save ---
            logger.info("🔎 Building BM25 index for menu search...")
            bm25_corpus = []
            bm25_id_map = []
            for idx, row in df_menu.iterrows():
                # Concatenate fields for BM25
                text = f"{row['name']} {row['description']} {row['category_brief']} {row['category_brief']} {row['group_category']}"
                bm25_corpus.append(text.lower().split())
                bm25_id_map.append(str(row['public_id']))
            bm25 = BM25Okapi(bm25_corpus)
            bm25_index_data = {
                'bm25': bm25,
                'id_map': bm25_id_map,
            }
            bm25_dir = Path(__file__).parent.parent / 'bm25_indexes'
            bm25_dir.mkdir(exist_ok=True)
            bm25_path = bm25_dir / f"{meta['slug']}_bm25.pkl"
            with open(bm25_path, 'wb') as f:
                pickle.dump(bm25_index_data, f)
            logger.success(f"✅ BM25 index saved to {bm25_path}")
            
            for idx, row in df_menu.iterrows():
                mi = db.query(MenuItem).filter_by(
                    restaurant_id=restaurant_id,
                    external_id=str(row["id"])
                ).first()
                if not mi:
                    mi = MenuItem(
                        public_id=str(row.get("public_id")),
                        restaurant_id=restaurant_id
                    )
                    db.add(mi)

                # Set core fields from CSV - using proper value extraction
                mi.name = str(row["name"])
                
                category_brief_val = row["category_brief"]
                mi.category_brief = str(category_brief_val) if pd.notna(category_brief_val) else ""
                
                group_category_val = row["group_category"]
                mi.group_category = str(group_category_val) if pd.notna(group_category_val) else ""
                
                description_val = row["description"]
                mi.description = str(description_val) if pd.notna(description_val) else ""
                
                show_on_menu_val = row["show_on_menu"]
                mi.show_on_menu = bool(show_on_menu_val) if pd.notna(show_on_menu_val) else True

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
                image_path_val = row["image_path"]
                mi.image_path = str(image_path_val) if pd.notna(image_path_val) and str(image_path_val).strip() else None
                
                cf_image_id_val = row["cloudflare_image_id"]
                mi.cloudflare_image_id = str(cf_image_id_val) if pd.notna(cf_image_id_val) and str(cf_image_id_val).strip() else None
                
                cf_video_id_val = row["cloudflare_video_id"]
                mi.cloudflare_video_id = str(cf_video_id_val) if pd.notna(cf_video_id_val) and str(cf_video_id_val).strip() else None
                
                # Set boolean and other fields
                veg_val = row.get("veg_flag")
                is_veg = bool(veg_val) if pd.notna(veg_val) else False
                mi.veg_flag = is_veg
                
                bestseller_val = row.get("is_bestseller")
                mi.is_bestseller = bool(bestseller_val) if pd.notna(bestseller_val) else False
                
                recommended_val = row.get("is_recommended")
                mi.is_recommended = bool(recommended_val) if pd.notna(recommended_val) else False
                
                kind_val = row.get("kind")
                mi.kind = str(kind_val) if pd.notna(kind_val) else "food"
                
                priority_val = row.get("priority")
                try:
                    mi.priority = int(priority_val) if pd.notna(priority_val) and priority_val is not None else 0
                except (ValueError, TypeError):
                    mi.priority = 0
                
                promote_val = row.get("promote")
                mi.promote = bool(promote_val) if pd.notna(promote_val) else False
                
                # Set new schema fields with defaults for simple restaurants
                external_id_val = row.get("id")
                mi.external_id = str(external_id_val) if pd.notna(external_id_val) and str(external_id_val).strip() else None
                mi.external_data = None  # No external data for simple restaurants
                mi.itemallowvariation = False  # Simple restaurants don't have variations
                mi.itemallowaddon = False  # Simple restaurants don't have addons
                mi.pos_system_id = None  # No POS system integration

                tags_val = row.get("tags", "")
                if isinstance(tags_val, pd.Series) or pd.isna(tags_val) or not str(tags_val).strip():
                    tags_list = []
                else:
                    tags_list = [tag.strip() for tag in str(tags_val).split(";") if tag.strip()]
                
                # Add "veg" tag if item is vegetarian and tag not already present
                if mi.veg_flag and "veg" not in [t.lower() for t in tags_list]:
                    tags_list.append("veg")
                mi.tags = tags_list  # Empty tags list

                # Add POS-specific basic fields (external_id, flags) if applicable
                if menu_api_data:
                    external_id_str = str(mi.external_id) if mi.external_id else None
                    if external_id_str and external_id_str in petpooja_items_map:
                        p_item = petpooja_items_map[external_id_str]
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

            logger.success(f"✅ Processed {menu_items_processed} menu items in PostgreSQL")
            
            # ---- POS-specific post-processing ----------------------------------

            if is_ppdinein:
                logger.info("🏢 Processing PetPooja dine-in data...")
                # Create POS system for dine-in
                pos_system = create_pos_system_for_dinein(
                    restaurant_id, meta.get("pos_config"), menu_api_data, areas_data, db
                )
                
                # Get the actual pos_system_id
                pos_system_id = pos_system.id
                
                # Create dummy variations from item data
                created_variations = create_dummy_variations_for_dinein_items(
                    menu_api_data, pos_system_id, db
                )
                
                # Process addon groups using utility function
                addon_groups_synced, addon_items_synced = process_dinein_addon_groups(
                    menu_api_data, pos_system_id, attributes_map, db
                )
                
                logger.success(f"✅ Processed {addon_groups_synced} addon groups, {addon_items_synced} addon items for dine-in")
                
                # Update menu items with POS system reference
                logger.info("🔗 Updating menu items with POS system reference...")
                db.query(MenuItem).filter(
                    MenuItem.restaurant_id == restaurant_id,
                    MenuItem.external_id.isnot(None)
                ).update({"pos_system_id": pos_system_id})
                
                # Create item relationships with dummy variations
                create_dinein_item_relationships(df_menu, menu_api_data, restaurant_id, pos_system_id, created_variations, db)
                
            elif is_no_pos:
                logger.info("🔗 Processing NoPOS data…")
                onboard_no_pos(folder, db, restaurant_id, df_menu, rest, logger)

            elif is_ppdelivery:
                # Regular PetPooja delivery processing
                logger.info("🔗 Processing PetPooja data...")
                petpooja_result = process_petpooja_data(menu_api_data, restaurant_id, meta.get("pos_config"), db)
                if petpooja_result.get("success"):
                    logger.info("🔗 Updating menu items with POS system reference...")
                    db.query(MenuItem).filter(
                        MenuItem.restaurant_id == restaurant_id,
                        MenuItem.external_id.isnot(None)
                    ).update({"pos_system_id": petpooja_result["pos_system_id"]})
                    create_item_relationships(df_menu, menu_api_data, restaurant_id, petpooja_result["pos_system_id"], db)

            # Now commit all database changes at once
            db.commit()
            logger.success("PostgreSQL seed complete ✔︎")

        # ---- Push embeddings to Qdrant (outside database transaction)
        logger.info("🔗 Pushing embeddings to Qdrant...")
        created_qdrant_collection = meta["slug"]
        qdrant_success = push_to_qdrant(meta["slug"], df_with_embeddings)
        
        if not qdrant_success:
            raise Exception("Failed to push embeddings to Qdrant")

        logger.success("Qdrant seed complete ✔︎")
        logger.success(f"🎉 On-boarding finished for {meta['restaurant_name']}")

    except Exception as e:
        logger.error(f"❌ Onboarding failed: {e}")
        
        # Rollback database changes by rolling back the session
        try:
            with SessionLocal() as rollback_db:
                if restaurant_id:
                    logger.info(f"🔄 Rolling back restaurant data for ID: {restaurant_id}")
                    # Delete restaurant and all related data (cascading)
                    restaurant_to_delete = rollback_db.query(Restaurant).filter_by(id=restaurant_id).first()
                    if restaurant_to_delete:
                        rollback_db.delete(restaurant_to_delete)
                        rollback_db.commit()
                        logger.success("✅ Database rollback complete")
        except Exception as rollback_error:
            logger.error(f"❌ Database rollback failed: {rollback_error}")
        
        # Rollback Qdrant collection
        try:
            if created_qdrant_collection:
                logger.info(f"🔄 Rolling back Qdrant collection: {created_qdrant_collection}_qdb")
                collection_name = f"{created_qdrant_collection}_qdb"
                qd.delete_collection(collection_name=collection_name)
                logger.success("✅ Qdrant rollback complete")
        except Exception as qdrant_rollback_error:
            logger.error(f"❌ Qdrant rollback failed: {qdrant_rollback_error}")
        
        # Re-raise the original exception
        raise e

# ---------- cli ---------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python 1_onboard_restaurants.py /path/to/restaurant_folder")
        sys.exit(1)

    folder = Path(sys.argv[1]).expanduser().resolve()
    if not folder.is_dir():
        logger.error("Provided path is not a directory")
        sys.exit(1)

    # try:
    #     seed_folder(folder)
    # except Exception as e:
    #     logger.error(f"❌ Onboarding failed: {e}")
    #     sys.exit(1)

    seed_folder(folder)

