# Restaurant Onboarding Guide

This guide explains how to add a new restaurant's menu data to the Qdrant vector database for the Aglio AI restaurant recommendation system.

## Overview

The restaurant onboarding process involves:
1. Creating a JSON file with menu items
2. Organizing restaurant images in a directory
3. Converting JSON to CSV format
4. Adding restaurant details to the onboarding configuration
5. Processing and uploading to Qdrant

## Step 1: Create Restaurant JSON File

Create a JSON file containing all menu items with the following structure:

### Required Fields
- `name`: Dish name
- `category`: Main category (e.g., "Pasta", "Pizza")
- `description`: Detailed description of the dish
- `price`: Price as a number

### Optional Fields
- `category_2`: Secondary/group category
- `is_vegetarian`: 1 for vegetarian, 0 for non-vegetarian
- `image`: Image filename or URL
- `image_url`: Alternative image URL
- `is_bestseller`: 1 if bestseller, 0 otherwise
- `is_chef_recommended`: 1 if chef recommended, 0 otherwise

### Example JSON Structure
```json
[
    {
        "name": "Spaghetti In Neapolitan Sauce",
        "category": "Pasta",
        "description": "Classic Italian Pasta Sauce Made With Fresh Tomatoes & Basil Then Tossed With Spaghetti.",
        "price": 595.0,
        "image": "ykplrecdzk1rdidpthhb",
        "category_2": "Pasta",
        "is_vegetarian": 1,
        "image_url": "https://media-assets.swiggy.com/swiggy/image/upload/ykplrecdzk1rdidpthhb",
        "is_bestseller": 1
    }
]
```

**File Location**: Save as `backend/raw_data/{restaurant_name}.json`

## Step 2: Organize Restaurant Images

Create a directory for restaurant images:

```
backend/raw_data/{restaurant_name}/
├── Dish_Name_1.png
├── Dish_Name_2.jpg
└── ...
```

### Image Guidelines
- Supported formats: `.jpg`, `.jpeg`, `.png`
- Naming convention: Use dish names with spaces replaced by underscores
- If images are URLs in the JSON, they will be automatically downloaded during processing

## Step 3: Convert JSON to CSV

Use the provided Jupyter notebook to convert JSON to CSV format:

1. Open `backend/notebooks/json2csv.ipynb`
2. Update the `jsons_to_parse` list with your restaurant details:

```python
jsons_to_parse = [
    {
        "raw_json": "/path/to/your_restaurant.json", 
        "output_csv": "/path/to/your_restaurant.csv", 
        "image_dir": "/path/to/your_restaurant_images"
    }
]
```

3. Run all cells in the notebook

### What the notebook does:
- Converts JSON to CSV with standardized columns
- Downloads images from URLs if present
- Generates proper filenames for images
- Creates boolean flags for vegetarian, bestseller, etc.

## Step 4: Update Restaurant Onboarding Configuration

Add your restaurant details to `backend/restaurant_onboarding.json`:

```json
{
    "restaurant_name": "your_restaurant_name",
    "image_directory": "/absolute/path/to/backend/raw_data/your_restaurant_name",
    "csv_file": "/absolute/path/to/backend/raw_data/your_restaurant_name.csv",
    "subdomain": "your_restaurant_subdomain",
    "qdrant_db_name": "your_restaurant_name_dishes",
    "added2qdrant": false
}
```

### Configuration Fields
- `restaurant_name`: Unique identifier for the restaurant
- `image_directory`: Absolute path to the image directory
- `csv_file`: Absolute path to the generated CSV file
- `subdomain`: Subdomain for restaurant-specific access
- `qdrant_db_name`: Name for the Qdrant collection (will be auto-generated)
- `added2qdrant`: Set to `false` initially (auto-updated after processing)

## Step 5: Process and Upload to Qdrant

Run the processing script to build embeddings and upload to Qdrant:

```bash
cd backend
python scripts/process_restaurants.py
```

### What the script does:
1. **Build Embeddings**: 
   - Creates text embeddings using SentenceTransformer
   - Creates image embeddings using CLIP
   - Combines text and image embeddings into 1280-dimensional vectors

2. **Upload to Qdrant**:
   - Creates a new collection in Qdrant
   - Uploads vectors with metadata
   - Updates the onboarding JSON with success status

3. **Generate IDs**:
   - Creates unique 6-character public IDs for each dish
   - Maintains database IDs for internal use

## Verification

After successful processing, verify the setup:

1. **Check Qdrant**: Ensure the collection exists and contains vectors
2. **Check Images**: Verify images are accessible in the image directory
3. **Test API**: Use the restaurant's subdomain to test menu retrieval

## File Structure Summary

```
backend/
├── raw_data/
│   ├── {restaurant_name}.json          # Original menu JSON
│   ├── {restaurant_name}.csv           # Generated CSV
│   └── {restaurant_name}/              # Image directory
│       ├── Dish_1.png
│       └── Dish_2.jpg
├── processed/
│   └── {restaurant_name}_menu_with_vec.pkl  # Processed data with embeddings
├── notebooks/
│   └── json2csv.ipynb                  # Conversion notebook
├── scripts/
│   └── process_restaurants.py          # Processing script
└── restaurant_onboarding.json          # Configuration file
```

## Prerequisites

- Python environment with required packages:
  - `pandas`
  - `torch`
  - `clip-by-openai`
  - `sentence-transformers`
  - `qdrant-client`
  - `PIL`
  - `loguru`
- Running Qdrant instance (local on port 6333)

## Troubleshooting

### Common Issues
1. **Missing Images**: Ensure image files exist or URLs are accessible
2. **CSV Format**: Verify all required columns are present
3. **Qdrant Connection**: Ensure Qdrant is running on localhost:6333
4. **Path Issues**: Use absolute paths in configuration

### Log Output
The processing script provides detailed logs showing:
- ✅ Successful operations
- ⚠️ Warnings for missing images
- ❌ Errors with specific details

## Next Steps

After successful onboarding:
1. Update the frontend to include the new restaurant
2. Test the recommendation system
3. Monitor vector search performance
4. Add restaurant-specific styling if needed 