from fastapi import APIRouter, Request, Form, UploadFile, File, HTTPException
from fastapi.responses import HTMLResponse
from typing import Optional
from pydantic import BaseModel
import json
import uuid
import os
import shutil
from pathlib import Path
import asyncio
import aiofiles
import requests
from PIL import Image
import numpy as np
import torch
import clip
from sentence_transformers import SentenceTransformer
import qdrant_client
from loguru import logger
import sys

# Add parent directory to path to import config
sys.path.append(str(Path(__file__).parent.parent))
from config import root_dir
from common.utils import download_instagram_content

router = APIRouter()

# Initialize models globally to avoid reloading
def get_models():
    """Get AI models for embedding generation"""
    try:
        mps = torch.backends.mps.is_available()
        device = "mps" if mps else "cpu"
        
        txt_model = SentenceTransformer("all-mpnet-base-v2", device=device)
        clip_model, preprocess = clip.load("ViT-B/32", device="cpu")
        
        return txt_model, clip_model, preprocess
    except Exception as e:
        logger.error(f"Error loading models: {e}")
        return None, None, None

def generate_short_uuid():
    """Generate a 6-character unique ID"""
    return str(uuid.uuid4()).replace('-', '')[:6]

def get_restaurant_data():
    """Load restaurant data from onboarding JSON"""
    onboarding_file = Path(__file__).parent.parent / "restaurant_onboarding.json"
    
    if not onboarding_file.exists():
        raise HTTPException(status_code=500, detail="Restaurant onboarding file not found")
    
    with open(onboarding_file, 'r') as f:
        restaurants_data = json.load(f)
    
    return restaurants_data



class ItemFormData(BaseModel):
    cafe_name: str
    name: str
    category_brief: str
    group_category: str
    description: str
    price: float
    veg_flag: bool
    is_bestseller: bool
    is_recommended: bool
    kind: str
    priority: int
    promote: bool
    image: bool
    instagram_url: str

@router.get("/item_form", response_class=HTMLResponse)
def get_item_form(request: Request):
    """Serve HTML form for adding new menu items"""
    
    html_content = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Add Menu Item</title>
        <style>
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f5f5f5;
            }
            
            .container {
                background-color: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            
            h1 {
                color: #333;
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 3px solid #007bff;
                padding-bottom: 10px;
            }
            
            .form-group {
                margin-bottom: 20px;
            }
            
            label {
                display: block;
                margin-bottom: 5px;
                font-weight: 600;
                color: #555;
            }
            
            input[type="text"],
            input[type="number"],
            input[type="url"],
            select,
            textarea {
                width: 100%;
                padding: 12px;
                border: 2px solid #ddd;
                border-radius: 5px;
                font-size: 16px;
                transition: border-color 0.3s;
            }
            
            input[type="text"]:focus,
            input[type="number"]:focus,
            input[type="url"]:focus,
            select:focus,
            textarea:focus {
                outline: none;
                border-color: #007bff;
            }
            
            textarea {
                height: 100px;
                resize: vertical;
            }
            
            .checkbox-group {
                display: flex;
                flex-wrap: wrap;
                gap: 20px;
                margin-top: 10px;
            }
            
            .checkbox-item {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            input[type="checkbox"] {
                width: 18px;
                height: 18px;
                accent-color: #007bff;
            }
            
            input[type="file"] {
                width: 100%;
                padding: 10px;
                border: 2px dashed #ddd;
                border-radius: 5px;
                background-color: #f9f9f9;
            }
            
            .file-group {
                display: none;
                margin-top: 10px;
            }
            
            .file-group.visible {
                display: block;
            }
            
            .submit-btn {
                background-color: #007bff;
                color: white;
                padding: 15px 30px;
                border: none;
                border-radius: 5px;
                font-size: 18px;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                margin-top: 20px;
                transition: background-color 0.3s;
            }
            
            .submit-btn:hover {
                background-color: #0056b3;
            }
            
            .submit-btn:disabled {
                background-color: #ccc;
                cursor: not-allowed;
            }
            
            .error {
                color: #dc3545;
                font-size: 14px;
                margin-top: 5px;
            }
            
            .success {
                background-color: #d4edda;
                color: #155724;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                display: none;
            }
            
            .required {
                color: #dc3545;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Add New Menu Item</h1>
            
            <div id="successMessage" class="success">
                Item added successfully!
            </div>
            
            <form id="itemForm">
                <div class="form-group">
                    <label for="cafe_name">Cafe Name <span class="required">*</span></label>
                    <select id="cafe_name" name="cafe_name" required>
                        <option value="">Select a cafe</option>
                        <option value="chianti">Chianti</option>
                        <option value="handcrafted">Handcrafted</option>
                    </select>
                    <div class="error" id="cafe_name_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="name">Item Name <span class="required">*</span></label>
                    <input type="text" id="name" name="name" required>
                    <div class="error" id="name_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="category_brief">Category Brief <span class="required">*</span></label>
                    <input type="text" id="category_brief" name="category_brief" required>
                    <div class="error" id="category_brief_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="group_category">Group Category <span class="required">*</span></label>
                    <input type="text" id="group_category" name="group_category" required>
                    <div class="error" id="group_category_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="description">Description <span class="required">*</span></label>
                    <textarea id="description" name="description" required placeholder="Enter item description..."></textarea>
                    <div class="error" id="description_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="price">Price <span class="required">*</span></label>
                    <input type="number" id="price" name="price" step="0.01" min="0" required>
                    <div class="error" id="price_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="kind">Kind <span class="required">*</span></label>
                    <select id="kind" name="kind" required>
                        <option value="">Select kind</option>
                        <option value="main">Main Course</option>
                        <option value="appetizer">Appetizer</option>
                        <option value="dessert">Dessert</option>
                        <option value="beverage">Beverage</option>
                        <option value="salad">Salad</option>
                        <option value="soup">Soup</option>
                        <option value="side">Side Dish</option>
                    </select>
                    <div class="error" id="kind_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="priority">Priority <span class="required">*</span></label>
                    <input type="number" id="priority" name="priority" min="1" max="10" value="5" required>
                    <div class="error" id="priority_error"></div>
                </div>
                
                <div class="form-group">
                    <label>Options</label>
                    <div class="checkbox-group">
                        <div class="checkbox-item">
                            <input type="checkbox" id="veg_flag" name="veg_flag">
                            <label for="veg_flag">Vegetarian</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="is_bestseller" name="is_bestseller">
                            <label for="is_bestseller">Bestseller</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="is_recommended" name="is_recommended">
                            <label for="is_recommended">Recommended</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="promote" name="promote">
                            <label for="promote">Promote</label>
                        </div>
                        <div class="checkbox-item">
                            <input type="checkbox" id="image" name="image">
                            <label for="image">Has Image</label>
                        </div>
                    </div>
                </div>
                
                <div class="form-group file-group" id="file_group">
                    <label for="image_file">Upload Image <span class="required">*</span></label>
                    <input type="file" id="image_file" name="image_file" accept="image/*">
                    <div class="error" id="image_file_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="instagram_url">Instagram URL</label>
                    <input type="url" id="instagram_url" name="instagram_url" placeholder="https://instagram.com/...">
                    <div class="error" id="instagram_url_error"></div>
                </div>
                
                <button type="submit" class="submit-btn" id="submitBtn">Update</button>
            </form>
        </div>
        
        <script>
            // Toggle file upload field based on image checkbox
            const imageCheckbox = document.getElementById('image');
            const fileGroup = document.getElementById('file_group');
            const fileInput = document.getElementById('image_file');
            
            imageCheckbox.addEventListener('change', function() {
                if (this.checked) {
                    fileGroup.classList.add('visible');
                    fileInput.required = true;
                } else {
                    fileGroup.classList.remove('visible');
                    fileInput.required = false;
                    fileInput.value = '';
                }
            });
            
            // Form validation
            function validateForm() {
                let isValid = true;
                const errors = document.querySelectorAll('.error');
                errors.forEach(error => error.textContent = '');
                
                // Required field validations
                const requiredFields = ['cafe_name', 'name', 'category_brief', 'group_category', 'description', 'price', 'kind', 'priority'];
                
                requiredFields.forEach(field => {
                    const input = document.getElementById(field);
                    const errorDiv = document.getElementById(field + '_error');
                    
                    if (!input.value.trim()) {
                        errorDiv.textContent = 'This field is required';
                        isValid = false;
                    }
                });
                
                // Price validation
                const price = document.getElementById('price').value;
                if (price && (isNaN(price) || parseFloat(price) <= 0)) {
                    document.getElementById('price_error').textContent = 'Price must be a positive number';
                    isValid = false;
                }
                
                // Image file validation
                if (imageCheckbox.checked && !fileInput.files.length) {
                    document.getElementById('image_file_error').textContent = 'Please upload an image';
                    isValid = false;
                }
                
                // Instagram URL validation
                const instagramUrl = document.getElementById('instagram_url').value;
                if (instagramUrl && !instagramUrl.startsWith('https://')) {
                    document.getElementById('instagram_url_error').textContent = 'URL must start with https://';
                    isValid = false;
                }
                
                return isValid;
            }
            
            // Form submission
            document.getElementById('itemForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                if (!validateForm()) {
                    return;
                }
                
                const formData = new FormData();
                const form = e.target;
                
                // Add all form fields to FormData
                formData.append('cafe_name', form.cafe_name.value);
                formData.append('name', form.name.value);
                formData.append('category_brief', form.category_brief.value);
                formData.append('group_category', form.group_category.value);
                formData.append('description', form.description.value);
                formData.append('price', form.price.value);
                formData.append('kind', form.kind.value);
                formData.append('priority', form.priority.value);
                formData.append('veg_flag', form.veg_flag.checked);
                formData.append('is_bestseller', form.is_bestseller.checked);
                formData.append('is_recommended', form.is_recommended.checked);
                formData.append('promote', form.promote.checked);
                formData.append('image', form.image.checked);
                formData.append('instagram_url', form.instagram_url.value);
                
                // Add file if image checkbox is checked
                if (form.image.checked && form.image_file.files.length > 0) {
                    formData.append('image_file', form.image_file.files[0]);
                }
                
                const submitBtn = document.getElementById('submitBtn');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Updating...';
                
                try {
                    const response = await fetch('/add/item', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        document.getElementById('successMessage').style.display = 'block';
                        form.reset();
                        fileGroup.classList.remove('visible');
                        fileInput.required = false;
                        
                        // Scroll to top to show success message
                        window.scrollTo({top: 0, behavior: 'smooth'});
                    } else {
                        alert('Error adding item: ' + (result.message || 'Unknown error'));
                    }
                } catch (error) {
                    alert('Error submitting form: ' + error.message);
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Update';
                }
            });
        </script>
    </body>
    </html>
    """
    
    return HTMLResponse(content=html_content, status_code=200)


@router.post("/item")
async def add_item(
    cafe_name: str = Form(...),
    name: str = Form(...),
    category_brief: str = Form(...),
    group_category: str = Form(...),
    description: str = Form(...),
    price: float = Form(...),
    kind: str = Form(...),
    priority: int = Form(...),
    veg_flag: bool = Form(False),
    is_bestseller: bool = Form(False),
    is_recommended: bool = Form(False),
    promote: bool = Form(False),
    image: bool = Form(False),
    instagram_url: str = Form(""),
    image_file: Optional[UploadFile] = File(None)
):
    """Handle form submission for adding new menu items"""
    
    try:
        # Load restaurant data
        restaurants_data = get_restaurant_data()
        
        # Find restaurant info
        restaurant_info = None
        for restaurant in restaurants_data:
            if restaurant["restaurant_name"] == cafe_name:
                restaurant_info = restaurant
                break
        
        if not restaurant_info:
            raise HTTPException(status_code=400, detail=f"Restaurant '{cafe_name}' not found")
        
        # Get models
        txt_model, clip_model, preprocess = get_models()
        if not txt_model or not clip_model:
            raise HTTPException(status_code=500, detail="Failed to load AI models")
        
        # Generate unique IDs
        public_id = generate_short_uuid()
        
        # Get collection info to determine next ID
        collection_name = restaurant_info["qdrant_db_name"]
        
        try:
            client = qdrant_client.QdrantClient("localhost", port=6333)
            
            # Check if collection exists
            collections = client.get_collections()
            collection_exists = any(col.name == collection_name for col in collections.collections)
            
            if not collection_exists:
                raise HTTPException(status_code=500, detail=f"Qdrant collection '{collection_name}' not found")
            
            # Get current count of items in collection using scroll method
            # This is more reliable than get_collection which has version compatibility issues
            try:
                count_result = client.count(collection_name=collection_name)
                current_count = count_result.count
            except:
                # Fallback: use scroll to get total count
                points, _ = client.scroll(
                    collection_name=collection_name,
                    limit=1,  # We just need to know if there are items
                    with_payload=False,
                    with_vectors=False
                )
                # Get the total count by scrolling through all items
                all_points, _ = client.scroll(
                    collection_name=collection_name,
                    limit=10000,  # Large number to get all items
                    with_payload=False,
                    with_vectors=False
                )
                current_count = len(all_points)
            
            # Set new item ID as count + 1
            item_id = current_count + 1
            
        except Exception as e:
            logger.error(f"Error getting collection info: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to get collection information: {str(e)}")
        
        # Prepare image handling
        image_directory = Path(restaurant_info["image_directory"])
        image_directory.mkdir(exist_ok=True)
        
        image_path = None
        i_vec = np.zeros(512)  # Default empty image vector
        
        # Handle image upload
        if image and image_file:
            # Generate unique filename
            file_extension = Path(image_file.filename).suffix if image_file.filename else ".jpg"
            unique_filename = f"{item_id}_{name.replace(' ', '_').replace('/', '_')}{file_extension}"
            image_path = image_directory / unique_filename
            
            # Save uploaded image
            async with aiofiles.open(image_path, 'wb') as f:
                content = await image_file.read()
                await f.write(content)
            
            # Generate image embedding
            try:
                img = preprocess(Image.open(image_path)).unsqueeze(0)
                with torch.no_grad():
                    i_vec = clip_model.encode_image(img)[0].cpu().numpy()
            except Exception as e:
                logger.warning(f"Error processing uploaded image: {e}")
                i_vec = np.zeros(512)
        
        # Handle Instagram URL
        elif instagram_url:
            # Generate base filename for Instagram content
            base_filename = f"{item_id}_instagram_{name.replace(' ', '_').replace('/', '_')}"
            
            downloaded_path, content_type, success = download_instagram_content(
                instagram_url, str(image_directory), base_filename
            )
            
            if success:
                if content_type == "image":
                    # Process image for embedding
                    try:
                        img = preprocess(Image.open(downloaded_path)).unsqueeze(0)
                        with torch.no_grad():
                            i_vec = clip_model.encode_image(img)[0].cpu().numpy()
                        image_path = Path(downloaded_path)
                        logger.info(f"✅ Instagram image downloaded and processed: {downloaded_path}")
                    except Exception as e:
                        logger.warning(f"Error processing Instagram image: {e}")
                        i_vec = np.zeros(512)
                elif content_type == "video":
                    # For videos, don't create embedding - use zero vector
                    i_vec = np.zeros(512)
                    image_path = Path(downloaded_path)
                    logger.info(f"✅ Instagram video downloaded (no embedding): {downloaded_path}")
                else:
                    logger.warning(f"Unknown Instagram content type: {content_type}")
                    i_vec = np.zeros(512)
            else:
                logger.warning("Failed to download Instagram content")
        
        # Generate text embedding
        text = f"{name} - {category_brief} - {description}"
        t_vec = txt_model.encode(text)
        
        # Combine text and image embeddings
        combined_vector = np.concatenate([t_vec, i_vec])
        
        # Prepare metadata following the structure from process_restaurants.py
        metadata = {
            "public_id": public_id,
            "name": name,
            "description": description,
            "price": price,
            "category_brief": category_brief,
            "group_category": group_category,
            "veg_flag": 1 if veg_flag else 0,
            "is_bestseller": is_bestseller,
            "is_recommended": is_recommended,
            "kind": kind,
            "priority": priority,
            "promote": promote,
            "instagram_url": instagram_url,
            "image_path": str(image_path.name) if image_path else None,
            "id": str(item_id)  # Store as string to match existing data format
        }
        
        # Add to Qdrant
        try:
            # Add point to Qdrant
            client.upsert(
                collection_name=collection_name,
                points=[
                    qdrant_client.http.models.PointStruct(
                        id=item_id,
                        vector=combined_vector.tolist(),
                        payload=metadata
                    )
                ]
            )
            
            logger.success(f"✅ Successfully added item '{name}' to {collection_name}")
            
            return {"success": True, "message": f"Item '{name}' added successfully", "public_id": public_id}
            
        except Exception as e:
            logger.error(f"Error adding to Qdrant: {e}")
            # Clean up uploaded image if Qdrant fails
            if image_path and image_path.exists():
                image_path.unlink()
            raise HTTPException(status_code=500, detail=f"Failed to add item to database: {str(e)}")
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in add_item: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}") 