#!/usr/bin/env python3
"""
Development server with automatic cache busting and file watching.
This script will automatically update version numbers when files change.
"""

import os
import sys
import time
from serve import serve_app
from update_version import update_version_numbers

def run_dev_server(port=8000):
    """Run development server with enhanced features."""
    
    print("🚀 Starting Aglio Restaurant Development Server")
    print("=" * 50)
    
    # Update version numbers on startup
    print("🔄 Updating cache-busting version numbers...")
    try:
        update_version_numbers()
    except Exception as e:
        print(f"⚠️  Warning: Could not update version numbers: {e}")
    
    print("\n💡 Development Tips:")
    print("   • After making CSS/JS changes, run: python update_version.py")
    print("   • Or restart this server to auto-update versions")
    print("   • Use Ctrl+Shift+R in browser for hard refresh")
    print("   • CSS/JS files are set to no-cache during development")
    print("=" * 50)
    
    # Start the server
    serve_app(port)

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("❌ Invalid port number. Using default port 8000.")
    
    run_dev_server(port) 