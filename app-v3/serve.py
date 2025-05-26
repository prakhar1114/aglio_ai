#!/usr/bin/env python3
"""
Simple HTTP server to serve the Aglio Restaurant mobile web app.
Run this script and access from any device on the same WiFi network.
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import socket

def get_local_ip():
    """Get the local IP address of this machine."""
    try:
        # Connect to a remote server to determine local IP
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "localhost"

def serve_app(port=8000):
    """Start a local HTTP server to serve the app."""
    
    # Change to the directory containing this script
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # Create server
    handler = http.server.SimpleHTTPRequestHandler
    
    # Add CORS headers and cache control for better compatibility
    class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
        def end_headers(self):
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            
            # Cache control headers to prevent caching issues during development
            if self.path.endswith(('.css', '.js')):
                # Disable caching for CSS and JS files during development
                self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
                self.send_header('Pragma', 'no-cache')
                self.send_header('Expires', '0')
            elif self.path.endswith('.html'):
                # Short cache for HTML files
                self.send_header('Cache-Control', 'max-age=300')  # 5 minutes
            else:
                # Longer cache for images and other static assets
                self.send_header('Cache-Control', 'max-age=3600')  # 1 hour
                
            super().end_headers()
    
    try:
        # Bind to all interfaces (0.0.0.0) instead of localhost
        with socketserver.TCPServer(("0.0.0.0", port), CORSRequestHandler) as httpd:
            local_ip = get_local_ip()
            
            print(f"🍽️  Aglio Restaurant App Server")
            print(f"📱 Local access: http://localhost:{port}")
            print(f"📱 Network access: http://{local_ip}:{port}")
            print(f"📱 Mobile access: Open http://{local_ip}:{port} on your phone")
            print(f"📂 Directory: {os.getcwd()}")
            print(f"🔗 Opening in browser...")
            print(f"⏹️  Press Ctrl+C to stop the server")
            print(f"📶 Make sure your phone is on the same WiFi network!")
            
            # Try to open the browser
            try:
                webbrowser.open(f'http://localhost:{port}')
            except Exception as e:
                print(f"⚠️  Could not open browser automatically: {e}")
                print(f"🔗 Please open http://localhost:{port} manually")
            
            # Start serving
            httpd.serve_forever()
            
    except KeyboardInterrupt:
        print(f"\n👋 Server stopped. Thanks for using Aglio Restaurant App!")
    except OSError as e:
        if "Address already in use" in str(e):
            print(f"❌ Port {port} is already in use. Try a different port:")
            print(f"   python serve.py {port + 1}")
        else:
            print(f"❌ Error starting server: {e}")

if __name__ == "__main__":
    # Allow custom port via command line argument
    port = 8000
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print("❌ Invalid port number. Using default port 8000.")
    
    serve_app(port) 