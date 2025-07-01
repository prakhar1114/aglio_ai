# Restaurant Onboarding v2: Streamlined PetPooja Integration

## Overview
Restaurant onboarding has evolved to a **hybrid single-script approach** that combines PetPooja API integration with manual CSV editing. This provides the best of both worlds: automated data extraction from POS systems with manual control over images and presentation details.

---

## **1. Current Architecture (v2)**

### **Onboarding Folder Structure**
```
restaurant_folder/
├── meta.json          # Restaurant metadata
├── tables.json        # Table configuration  
├── hours.json         # Operating hours (optional)
├── menu.csv          # Core dish items (generated from menu.json using scripts/generate_menu_csv.py file, manually editable)
├── menu.json         # Raw PetPooja API response
└── images/           # Menu item images
    ├── pizza.jpg
    ├── pasta.jpg
    └── ...
```

### **Processing Flow**
```
1. Prepare Onboarding Data
   ├── Fetch menu.json from PetPooja API
   ├── Generate menu.csv using generate_menu_csv.py
   ├── Edit menu.csv to add image_path, add cloudflare_image_id and cloudflare_video_id if they exist to prevent reuploads of same media, update is_veg field
   └── Add images to images/ folder

2. Run Onboarding Script  
   ├── Validate all required files
   ├── Process menu items from CSV
   ├── Handle image URLs/uploads to Cloudflare
   ├── Process PetPooja variations/addons from JSON
   ├── Create item relationships
   ├── Generate embeddings
   └── Push to Qdrant
```

---

## **2. Implementation Scripts**

### **CSV Generation Script**: `backend/scripts/generate_menu_csv.py`
```python
# Usage: python generate_menu_csv.py /path/to/restaurant_folder

def extract_menu_items_from_json(menu_json_path: Path) -> list:
    """Extract core menu item data from PetPooja menu.json"""
    
def generate_csv_from_menu_data(menu_items: list, output_path: Path):
    """Generate editable CSV with core item fields + image_path"""
```

**Generated CSV Columns:**
- `name`, `category_brief`, `group_category`, `description`, `price`
- `veg_flag`, `is_bestseller`, `is_recommended`, `kind`, `priority`, `promote`
- `public_id`, `external_id` (PetPooja item ID)
- `image_path`, `cloudflare_image_id`, `cloudflare_video_id`

### **Enhanced Onboarding Script**: `backend/scripts/1_onboard_restaurants.py`

**New Requirements:**
```python
# Required files validation
assert (folder / "meta.json").exists(), "meta.json missing"
assert (folder / "tables.json").exists(), "tables.json missing"
assert (folder / "menu.csv").exists(), "menu.csv missing"
assert (folder / "menu.json").exists(), "menu.json missing"  # NEW
assert (folder / "images").exists(), "images directory missing"
```

**Key Functions:**
```python
def validate_and_clean_csv(df_menu: pd.DataFrame) -> pd.DataFrame:
    """Validate CSV format and clean extra columns"""

def process_image_urls_and_upload_to_cloudflare():
    """Smart upload - skip if cloudflare_image_id already exists"""

def process_petpooja_data(menu_api_data: dict, restaurant_id: int, db):
    """Process variations and addons from menu.json"""

def create_item_relationships():
    """Create ItemVariation and ItemAddon relationships"""
```

---

## **3. Step-by-Step Onboarding Process**

### **Step 1: Prepare Restaurant Metadata**
Create standard JSON configuration files:

**meta.json:**
```json
{
  "public_id": "rest_abc123",
  "slug": "restaurant-name",
  "restaurant_name": "Restaurant Name",
  "tz": "Asia/Kolkata"
}
```

**tables.json:**
```json
{
  "number_of_tables": 20,
  "pass_required": true,
  "password": "daily_password"
}
```

**hours.json:** (optional)
```json
[
  {"day": 1, "opens_at": "09:00", "closes_at": "23:00"},
  {"day": 2, "opens_at": "09:00", "closes_at": "23:00"}
]
```

### **Step 2: Fetch PetPooja Menu Data**
```bash
# Get menu.json from PetPooja API
curl -X GET "https://api.petpooja.com/menu" \
     -H "Authorization: Bearer <token>" \
     > menu.json
```

### **Step 3: Generate Editable CSV**
```bash
cd backend
python scripts/generate_menu_csv.py /path/to/restaurant_folder
```

This creates `menu.csv` with all menu items extracted from `menu.json`, including:
- Core item details (name, description, price, category)
- PetPooja external_id for integration
- Empty image_path column for manual editing
- Default values for flags and priorities

### **Step 4: Edit CSV and Add Images**
```bash
# Manual steps:
1. Edit menu.csv to add image_path values
2. Add corresponding images to images/ folder
3. Optionally set is_bestseller, is_recommended flags
4. Adjust priorities and categories if needed
```

**CSV Editing Example:**
```csv
name,category_brief,description,price,image_path,external_id,veg_flag
"Veg Pizza","Main Course","Delicious pizza",299.00,"pizza.jpg","123",true
"Chicken Curry","Main Course","Spicy curry",399.00,"curry.jpg","124",false
```

### **Step 5: Run Onboarding Script**
```bash
cd backend
python scripts/1_onboard_restaurants.py /path/to/restaurant_folder
```

**Script Processing:**
1. ✅ **Validate Files**: Checks all required files exist
2. 🏗️ **Restaurant Setup**: Creates restaurant, tables, hours
3. 📄 **CSV Processing**: Validates and cleans menu.csv
4. 🖼️ **Image Handling**: Downloads URLs, uploads to Cloudflare (smart skip)
5. 🔗 **PetPooja Integration**: Processes variations/addons from menu.json
6. 🎯 **Relationships**: Creates ItemVariation and ItemAddon links
7. 🧠 **Embeddings**: Generates and pushes to Qdrant

---

## **4. Database Schema Integration**

### **File Reference**: `backend/models/schema.py`

**Enhanced MenuItem with PetPooja fields:**
```python
class MenuItem(Base):
    # Core fields from CSV
    name = Column(String(255), nullable=False)
    description = Column(Text)
    price = Column(Numeric(10, 2), nullable=False)
    category_brief = Column(String(100))
    
    # PetPooja integration fields (from menu.json)
    external_id = Column(String(100))  # PetPooja item ID
    external_data = Column(JSON)  # Raw PetPooja item data
    itemallowvariation = Column(Boolean, default=False)
    itemallowaddon = Column(Boolean, default=False)
    pos_system_id = Column(Integer, ForeignKey('pos_systems.id'))
    
    # Image fields (from CSV editing)
    image_path = Column(String(255))
    cloudflare_image_id = Column(String(100))
    cloudflare_video_id = Column(String(100))
```

**PetPooja Global Entities:**
```python
class POSSystem(Base):
    """Links restaurant to PetPooja account"""
    
class Variation(Base):
    """Global variations like Size, Quantity"""
    external_variation_id = Column(String(100))  # PetPooja variation ID
    
class AddonGroup(Base):
    """Global addon groups like Extra Toppings"""
    external_group_id = Column(String(100))  # PetPooja group ID
    
class AddonGroupItem(Base):
    """Individual addon items with tags from attributes"""
    external_addon_id = Column(String(100))  # PetPooja addon ID
    tags = Column(JSON)  # Decoded from PetPooja attributes
```

---

## **5. Smart Features**

### **Intelligent Image Upload**
```python
# Only upload if Cloudflare IDs are missing
if (local_file_path and Path(local_file_path).exists() and 
    pd.isna(row.get('cloudflare_image_id')) and 
    pd.isna(row.get('cloudflare_video_id'))):
    # Upload to Cloudflare
```

**Benefits:**
- Re-running script doesn't re-upload existing images
- Faster processing for updates
- Cost optimization for Cloudflare usage

### **Tag Processing**
```python
# For Menu Items
tags_list = petpooja_item.get("item_tags", []).copy()
attr_id_val = petpooja_item.get("item_attributeid")
if attr_id_val and attr_id_val in attributes_map:
    tags_list.append(attributes_map[attr_id_val])

# For Addon Items  
tags = [attributes_map.get(attr_id.strip()) 
        for attr_id in addon_item_data.get("attributes", "").split(",") 
        if attr_id.strip() and attr_id.strip() in attributes_map]
```

**Benefits:**
- Automatic tag extraction from PetPooja attributes
- Clean, readable tags for filtering and search
- Consistent tagging across menu items and addons

### **External ID Mapping**
```python
# Store PetPooja IDs for order placement
mi.external_id = external_id  # Item ID
item_variation.external_id = var_data["id"]  # Variation ID for orders
addon_item.external_addon_id = addon_item_data["addonitemid"]  # Addon ID
```

**Benefits:**
- Seamless order placement to PetPooja
- Accurate price and option mapping
- Maintains sync with POS system

---

## **6. Error Handling & Validation**

### **File Validation**
```python
# Required columns check
required_columns = ['name', 'category_brief', 'group_category', 'description', 'price']
missing_columns = [col for col in required_columns if col not in df_menu.columns]
if missing_columns:
    raise ValueError(f"Missing required columns in CSV: {missing_columns}")
```

### **Data Validation**
```python
# Price handling with fallbacks
try:
    if pd.notna(row["price"]) and str(row["price"]).strip():
        mi.price = float(row["price"])
    else:
        logger.warning(f"Missing price for {row['name']}, setting to 0.0")
        mi.price = 0.0
except (ValueError, TypeError):
    logger.warning(f"Invalid price for {row['name']}, setting to 0.0")
    mi.price = 0.0
```

### **Image Processing**
```python
# URL download with fallbacks
try:
    if is_instagram_url(image_url):
        downloaded_path, content_type, success = download_instagram_content(...)
    else:
        downloaded_path, content_type, success = download_url_content(...)
except Exception as e:
    logger.error(f"Error downloading URL for {row['name']}: {e}")
    processed_df.at[idx, 'image_path'] = None
```

---

## **7. Performance Optimizations**

### **Batch Processing**
- Process all menu items before PetPooja data
- Bulk create variations and addon groups
- Efficient relationship creation with lookups

### **Smart Uploads**
- Skip Cloudflare uploads if IDs already exist
- Reuse existing POS system records
- Avoid duplicate relationship creation

### **Memory Management**
- Process images individually to avoid memory spikes
- Use database sessions properly with commits
- Clean up temporary files after processing

---

## **8. Output & Results**

### **Console Output**
```bash
🏗️  Restaurant created id=123
🔑 API Key generated: sk_abc123xyz789
📋 CSV validated and cleaned: 45 rows, 16 columns
📷 Processing image URLs and uploading to Cloudflare
☁️  Cloudflare upload successful for Veg Pizza
🔗 Processing PetPooja variations and addons...
✅ PetPooja data processed: 12 variations, 8 addon groups, 24 addon items
🔗 Creating item-variation and item-addon relationships...
✅ Created 67 item relationships
🧠 Generating embeddings for menu items...
📤 Pushing embeddings to Qdrant collection: restaurant_qdb
✅ Uploaded 45 embeddings to Qdrant
🎉 Onboarding finished for Restaurant Name
```

### **Generated Files**
```
restaurant_folder/
├── menu_processed.csv     # Updated CSV with processed image paths
└── (all original files preserved)
```

### **Database Records Created**
- 1 Restaurant with API key
- N Tables with QR tokens
- 45 Menu Items with PetPooja integration
- 12 Global Variations
- 8 Global Addon Groups with 24 items
- 67 Item-Variation and Item-Addon relationships
- 1 POS System record

---

## **9. Advantages of v2 Approach**

### **✅ Benefits**
1. **Single Script Simplicity**: One command for complete onboarding
2. **PetPooja Integration**: Automatic variations and addons extraction
3. **Manual Control**: Edit CSV for images and presentation details
4. **Smart Processing**: Skip existing uploads, handle errors gracefully
5. **Complete Setup**: Restaurant ready for orders immediately
6. **Rerunnable**: Safe to run multiple times with updates

### **🎯 Use Cases**
- **New Restaurant**: Complete onboarding from PetPooja data
- **Menu Updates**: Refresh variations/addons from PetPooja
- **Image Updates**: Add/change images without affecting menu structure
- **Data Fixes**: Correct pricing or descriptions via CSV editing

---

## **10. Comparison with v1**

| Aspect | v1 (Pure Manual) | v2 (Hybrid) |
|--------|------------------|-------------|
| **Data Entry** | Manual CSV creation | Auto-generated from PetPooja |
| **Variations** | Not supported | Automatic from PetPooja |
| **Addons** | Not supported | Automatic from PetPooja |
| **Images** | Manual upload | CSV editing + smart upload |
| **Integration** | None | Full PetPooja mapping |
| **Scalability** | Limited | High with automation |
| **Accuracy** | Error-prone | POS system accuracy |
| **Time Required** | Days | Hours |

---

## **11. Future Enhancements**

### **Dashboard Integration**
- Web interface for CSV editing
- Drag-drop image upload
- PetPooja sync status monitoring
- Bulk menu operations

### **Advanced Features**
- **Incremental Sync**: Update only changed items
- **Conflict Resolution**: Handle PetPooja vs manual changes
- **Multi-POS Support**: Support for other POS systems
- **Automated Scheduling**: Regular sync with PetPooja

### **Monitoring & Analytics**
- Onboarding success metrics
- Performance monitoring
- Error tracking and alerts
- Usage analytics

---

## **12. File Reference Summary**

| Component | File Path | Purpose |
|-----------|-----------|---------|
| **CSV Generator** | `backend/scripts/generate_menu_csv.py` | Extract CSV from menu.json |
| **Main Onboarding** | `backend/scripts/1_onboard_restaurants.py` | Complete restaurant setup |
| **Database Schema** | `backend/models/schema.py` | Enhanced models with PetPooja |
| **PetPooja Service** | `backend/services/pos/petpooja.py` | PetPooja integration logic |
| **Test Data** | `backend/onboarding_data/test/` | Sample onboarding folder |
| **Test Suite** | `backend/test/test_petpooja_sync.py` | Comprehensive testing |

---

## **13. Migration Guide**

### **From v1 to v2**
```bash
# For existing restaurants
1. Export current menu to CSV format
2. Fetch menu.json from PetPooja
3. Map existing items to PetPooja external_ids
4. Run v2 onboarding script
5. Verify data integrity and relationships
```

### **Data Preservation**
- Existing menu items preserved
- Images and Cloudflare IDs maintained  
- Restaurant settings kept intact
- Table configurations preserved

---

This v2 onboarding architecture provides a **practical, scalable solution** that combines the automation benefits of POS integration with the flexibility of manual control where needed. The single-script approach reduces complexity while providing comprehensive restaurant setup with PetPooja integration.

## **Quick Start**
```bash
# 1. Get PetPooja menu data
curl -X GET "https://api.petpooja.com/menu" > menu.json

# 2. Generate editable CSV  
python scripts/generate_menu_csv.py /path/to/restaurant_folder

# 3. Edit menu.csv and add images

# 4. Run complete onboarding
python scripts/1_onboard_restaurants.py /path/to/restaurant_folder
```

**Result**: Restaurant fully configured with menu, variations, addons, images, and ready for orders! 🎉

