#!/usr/bin/env python3
"""
Utility script to update cache-busting version numbers in HTML files.
Run this script whenever you make changes to CSS or JS files.
"""

import re
import time
from datetime import datetime

def update_version_numbers(html_file='index.html'):
    """Update version numbers in HTML file for cache busting."""
    
    # Generate new version based on current timestamp
    new_version = str(int(time.time()))
    
    # Read the HTML file
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Pattern to match version parameters
    css_pattern = r'(href="css/[^"]+\.css)\?v=[^"]*(")'
    js_pattern = r'(src="js/[^"]+\.js)\?v=[^"]*(")'
    
    # Replace version numbers
    content = re.sub(css_pattern, f'\\1?v={new_version}\\2', content)
    content = re.sub(js_pattern, f'\\1?v={new_version}\\2', content)
    
    # Write back to file
    with open(html_file, 'w', encoding='utf-8') as f:
        f.write(content)
    
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"✅ Updated version numbers to {new_version} at {timestamp}")
    print(f"📝 Updated file: {html_file}")
    print(f"🔄 Clear your browser cache or do a hard refresh to see changes")

if __name__ == "__main__":
    update_version_numbers() 