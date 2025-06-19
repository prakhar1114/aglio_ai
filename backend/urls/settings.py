from fastapi import APIRouter, Request, HTTPException, Form
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional
import json
from pathlib import Path
from loguru import logger

router = APIRouter()

class RestaurantSettings(BaseModel):
    number_of_tables: int
    pass_required: bool
    password: Optional[str] = None

class RestaurantSettingsResponse(BaseModel):
    restaurant_name: str
    settings: RestaurantSettings
    message: Optional[str] = None

# Global variable to store settings in memory
_settings_cache = {}

def load_settings_to_memory():
    """Load restaurant settings from JSON file into memory"""
    global _settings_cache
    settings_file = Path(__file__).parent.parent / "restaurant_settings.json"
    
    if not settings_file.exists():
        logger.warning(f"Restaurant settings file not found: {settings_file}")
        _settings_cache = {}
        return
    
    try:
        with open(settings_file, 'r') as f:
            _settings_cache = json.load(f)
        logger.info(f"Loaded settings for {len(_settings_cache)} restaurants into memory")
    except Exception as e:
        logger.error(f"Error loading restaurant settings: {e}")
        _settings_cache = {}

def save_settings_to_file():
    """Save current settings from memory to JSON file"""
    global _settings_cache
    settings_file = Path(__file__).parent.parent / "restaurant_settings.json"
    
    try:
        with open(settings_file, 'w') as f:
            json.dump(_settings_cache, f, indent=4)
        logger.info(f"Saved settings to {settings_file}")
        return True
    except Exception as e:
        logger.error(f"Error saving restaurant settings: {e}")
        return False

def get_restaurant_settings(restaurant_name: str) -> Optional[RestaurantSettings]:
    """Get settings for a specific restaurant from memory"""
    global _settings_cache
    if not _settings_cache:
        load_settings_to_memory()
    
    restaurant_data = _settings_cache.get(restaurant_name)
    if restaurant_data:
        return RestaurantSettings(**restaurant_data)
    return None

def update_restaurant_settings(restaurant_name: str, settings: RestaurantSettings) -> bool:
    """Update settings for a specific restaurant in memory and file"""
    global _settings_cache
    if not _settings_cache:
        load_settings_to_memory()
    
    _settings_cache[restaurant_name] = settings.model_dump()
    return save_settings_to_file()

def get_all_settings():
    """Get all restaurant settings from memory (for external modules)"""
    global _settings_cache
    if not _settings_cache:
        load_settings_to_memory()
    return _settings_cache

# Initialize settings cache on module load
load_settings_to_memory()

@router.get("/", response_class=HTMLResponse, summary="Get restaurant settings form")
def get_settings_form(restaurant_name: Optional[str] = None):
    """Get HTML form with restaurant selection and settings"""
    
    # Get all available restaurants
    all_restaurants = list(get_all_settings().keys())
    
    # If no restaurant selected, use the first one as default
    selected_restaurant = restaurant_name if restaurant_name and restaurant_name in all_restaurants else (all_restaurants[0] if all_restaurants else None)
    
    if not selected_restaurant:
        return HTMLResponse(content="<h1>No restaurants configured</h1>", status_code=404)
    
    # Get current settings for selected restaurant
    current_settings = get_restaurant_settings(selected_restaurant)
    if not current_settings:
        # Default settings if none exist
        current_settings = RestaurantSettings(
            number_of_tables=20,
            pass_required=False,
            password=""
        )
    
    # Generate restaurant dropdown options
    restaurant_options = ""
    for restaurant in all_restaurants:
        selected = "selected" if restaurant == selected_restaurant else ""
        restaurant_options += f'<option value="{restaurant}" {selected}>{restaurant.title()}</option>'
    
    # Generate HTML form
    form_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Restaurant Settings Management</title>
        <style>
            body {{
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 50px auto;
                padding: 20px;
                background-color: #f5f5f5;
            }}
            .container {{
                background: white;
                padding: 30px;
                border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }}
            h1 {{
                color: #333;
                text-align: center;
                margin-bottom: 30px;
            }}
            .form-group {{
                margin-bottom: 20px;
            }}
            label {{
                display: block;
                margin-bottom: 5px;
                font-weight: bold;
                color: #555;
            }}
            input[type="number"], input[type="text"], select {{
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
                box-sizing: border-box;
            }}
            select {{
                background-color: white;
                cursor: pointer;
            }}
            input[type="checkbox"] {{
                margin-right: 10px;
                transform: scale(1.2);
            }}
            .checkbox-group {{
                display: flex;
                align-items: center;
                margin-top: 5px;
            }}
            button {{
                background-color: #007bff;
                color: white;
                padding: 12px 30px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 16px;
                width: 100%;
                margin-top: 20px;
            }}
            button:hover {{
                background-color: #0056b3;
            }}
            .restaurant-selector {{
                background-color: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                margin-bottom: 20px;
                border-left: 4px solid #007bff;
            }}
        </style>
        <script>
            function changeRestaurant() {{
                const select = document.getElementById('restaurant_select');
                const selectedRestaurant = select.value;
                window.location.href = '/settings/?restaurant_name=' + selectedRestaurant;
            }}
        </script>
    </head>
    <body>
        <div class="container">
            <h1>Restaurant Settings Management</h1>
            
            <div class="restaurant-selector">
                <label for="restaurant_select">Select Restaurant:</label>
                <select id="restaurant_select" onchange="changeRestaurant()">
                    {restaurant_options}
                </select>
            </div>
            
            <form method="post" action="/settings/">
                <input type="hidden" name="restaurant_name" value="{selected_restaurant}">
                
                <div class="form-group">
                    <label for="number_of_tables">Number of Tables:</label>
                    <input type="number" id="number_of_tables" name="number_of_tables" 
                           value="{current_settings.number_of_tables}" min="1" max="1000" required>
                </div>
                
                <div class="form-group">
                    <label>Daily Password Protection:</label>
                    <div class="checkbox-group">
                        <input type="checkbox" id="pass_required" name="pass_required" 
                               value="true" {"checked" if current_settings.pass_required else ""}>
                        <label for="pass_required">Require daily password for ordering</label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="password">Daily Password:</label>
                    <input type="text" id="password" name="password" 
                           value="{current_settings.password or ''}" 
                           placeholder="Enter daily password (optional)">
                    <small style="color: #6c757d;">Leave empty if password protection is disabled</small>
                </div>
                
                <button type="submit">Update Settings for {selected_restaurant.title()}</button>
            </form>
        </div>
    </body>
    </html>
    """
    
    return form_html

@router.post("/", response_model=RestaurantSettingsResponse, summary="Update restaurant settings")
def update_settings(
    restaurant_name: str = Form(...),
    number_of_tables: int = Form(...),
    pass_required: bool = Form(False),
    password: Optional[str] = Form(None)
):
    """Update restaurant settings from form submission"""
    
    # Clean up password field
    if password == "":
        password = None
    
    # Create settings object
    new_settings = RestaurantSettings(
        number_of_tables=number_of_tables,
        pass_required=pass_required,
        password=password
    )
    
    # Update settings
    success = update_restaurant_settings(restaurant_name, new_settings)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save settings")
    
    logger.info(f"Updated settings for restaurant: {restaurant_name}")
    
    return RestaurantSettingsResponse(
        restaurant_name=restaurant_name,
        settings=new_settings,
        message="Settings updated successfully"
    )

@router.get("/api", response_model=RestaurantSettingsResponse, summary="Get restaurant settings as JSON")
def get_settings_api(restaurant_name: str):
    """Get current restaurant settings as JSON (API endpoint)"""
    
    # Validate restaurant exists
    all_restaurants = list(get_all_settings().keys())
    if restaurant_name not in all_restaurants:
        raise HTTPException(status_code=404, detail=f"Restaurant '{restaurant_name}' not found")
    
    current_settings = get_restaurant_settings(restaurant_name)
    if not current_settings:
        # Return default settings if none exist
        current_settings = RestaurantSettings(
            number_of_tables=20,
            pass_required=False,
            password=None
        )
    
    return RestaurantSettingsResponse(
        restaurant_name=restaurant_name,
        settings=current_settings
    )

@router.get("/restaurants", summary="List all available restaurants")
def list_restaurants():
    """Get list of all available restaurants"""
    all_restaurants = list(get_all_settings().keys())
    return {"restaurants": all_restaurants, "count": len(all_restaurants)}

@router.get("/reload", summary="Reload settings from file")
def reload_settings():
    """Manually reload settings from file into memory"""
    load_settings_to_memory()
    return {"message": f"Reloaded settings for {len(_settings_cache)} restaurants"} 