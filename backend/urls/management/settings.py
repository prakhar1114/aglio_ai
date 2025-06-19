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

def get_restaurant_names():
    """Get list of all restaurant names"""
    global _settings_cache
    if not _settings_cache:
        load_settings_to_memory()
    return list(_settings_cache.keys())

# Initialize settings cache on module load
load_settings_to_memory()

@router.get("/", response_class=HTMLResponse, summary="Get restaurant settings form")
def get_settings_form(request: Request, restaurant: str = None):
    """Get HTML form with current restaurant settings"""
    # Get all available restaurants
    restaurant_names = get_restaurant_names()
    
    if not restaurant_names:
        return """
        <html>
        <body>
            <h1>No restaurants found</h1>
            <p>Please check restaurant_settings.json file.</p>
        </body>
        </html>
        """
    
    # If no restaurant selected, show selection form
    if not restaurant:
        restaurant_options = "\n".join([
            f'<option value="{name}">{name.title()}</option>' 
            for name in restaurant_names
        ])
        
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Restaurant Settings - Admin</title>
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
                select {{
                    width: 100%;
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    margin-bottom: 20px;
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
                }}
                button:hover {{
                    background-color: #0056b3;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Restaurant Settings</h1>
                <form method="get" action="/settings/">
                    <label for="restaurant">Select Restaurant:</label>
                    <select name="restaurant" id="restaurant" required>
                        <option value="">-- Choose a restaurant --</option>
                        {restaurant_options}
                    </select>
                    <button type="submit">Manage Settings</button>
                </form>
            </div>
        </body>
        </html>
        """
    
    # Validate selected restaurant
    if restaurant not in restaurant_names:
        return f"""
        <html>
        <body>
            <h1>Restaurant not found</h1>
            <p>Restaurant '{restaurant}' not found.</p>
            <a href="/settings/">Go back</a>
        </body>
        </html>
        """
    
    # Get current settings for selected restaurant
    current_settings = get_restaurant_settings(restaurant)
    if not current_settings:
        # Default settings if none exist
        current_settings = RestaurantSettings(
            number_of_tables=20,
            pass_required=False,
            password=""
        )
    
    # Generate HTML form
    form_html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Restaurant Settings - {restaurant}</title>
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
            input[type="number"], input[type="text"] {{
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 5px;
                box-sizing: border-box;
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
            .restaurant-name {{
                background-color: #e9ecef;
                padding: 10px;
                border-radius: 5px;
                text-align: center;
                margin-bottom: 20px;
                color: #6c757d;
            }}
            .back-link {{
                text-align: center;
                margin-bottom: 20px;
            }}
            .back-link a {{
                color: #007bff;
                text-decoration: none;
            }}
            .back-link a:hover {{
                text-decoration: underline;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="back-link">
                <a href="/settings/">← Back to Restaurant Selection</a>
            </div>
            <h1>Restaurant Settings</h1>
            <div class="restaurant-name">
                <strong>Restaurant:</strong> {restaurant.title()}
            </div>
            
            <form method="post" action="/settings/">
                <input type="hidden" name="restaurant_name" value="{restaurant}">
                
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
                
                <button type="submit">Update Settings</button>
            </form>
        </div>
    </body>
    </html>
    """
    
    return form_html

@router.post("/", response_model=RestaurantSettingsResponse, summary="Update restaurant settings")
def update_settings(
    request: Request,
    restaurant_name: str = Form(...),
    number_of_tables: int = Form(...),
    pass_required: bool = Form(False),
    password: Optional[str] = Form(None)
):
    """Update restaurant settings from form submission"""
    # Validate restaurant exists
    restaurant_names = get_restaurant_names()
    if restaurant_name not in restaurant_names:
        raise HTTPException(status_code=400, detail=f"Restaurant '{restaurant_name}' not found")
    
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
def get_settings_api(request: Request, restaurant: str):
    """Get current restaurant settings as JSON (API endpoint)"""
    # Validate restaurant exists
    restaurant_names = get_restaurant_names()
    if restaurant not in restaurant_names:
        raise HTTPException(status_code=400, detail=f"Restaurant '{restaurant}' not found")
    
    current_settings = get_restaurant_settings(restaurant)
    if not current_settings:
        # Return default settings if none exist
        current_settings = RestaurantSettings(
            number_of_tables=20,
            pass_required=False,
            password=None
        )
    
    return RestaurantSettingsResponse(
        restaurant_name=restaurant,
        settings=current_settings
    )

@router.get("/reload", summary="Reload settings from file")
def reload_settings():
    """Manually reload settings from file into memory"""
    load_settings_to_memory()
    return {"message": f"Reloaded settings for {len(_settings_cache)} restaurants"} 