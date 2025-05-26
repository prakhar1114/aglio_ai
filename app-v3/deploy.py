#!/usr/bin/env python3
"""
Production deployment script for Vercel.
Updates cache-busting version numbers before deploying.
"""

import subprocess
import sys
import time
from datetime import datetime
from update_version import update_version_numbers

def deploy_to_vercel(environment="production"):
    """Deploy to Vercel with cache busting."""
    
    print("🚀 Aglio Restaurant - Vercel Deployment")
    print("=" * 50)
    
    # Step 1: Update version numbers for cache busting
    print("🔄 Step 1: Updating cache-busting version numbers...")
    try:
        update_version_numbers()
        print("✅ Version numbers updated successfully")
    except Exception as e:
        print(f"❌ Error updating version numbers: {e}")
        return False
    
    # Step 2: Deploy to Vercel
    print(f"\n🌐 Step 2: Deploying to Vercel ({environment})...")
    try:
        if environment == "production":
            cmd = ["vercel", "--prod"]
        else:
            cmd = ["vercel"]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ Deployment successful!")
            print("\n📋 Deployment Details:")
            print(result.stdout)
            
            # Extract URL from output if possible
            lines = result.stdout.split('\n')
            for line in lines:
                if 'https://' in line and ('vercel.app' in line or 'aglio' in line):
                    print(f"🔗 Live URL: {line.strip()}")
                    break
        else:
            print("❌ Deployment failed!")
            print("Error:", result.stderr)
            return False
            
    except FileNotFoundError:
        print("❌ Vercel CLI not found. Please install it first:")
        print("   npm i -g vercel")
        return False
    except Exception as e:
        print(f"❌ Deployment error: {e}")
        return False
    
    # Step 3: Post-deployment instructions
    print("\n💡 Post-deployment Tips:")
    print("   • Clear browser cache to see changes: Ctrl+Shift+R")
    print("   • Vercel automatically handles CDN cache invalidation")
    print("   • CSS/JS files are cached for 1 year (with version parameters)")
    print("   • HTML files are not cached (always fresh)")
    print("=" * 50)
    
    return True

def main():
    """Main deployment function."""
    environment = "production"
    
    # Check command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] in ["preview", "staging"]:
            environment = "preview"
        elif sys.argv[1] == "production":
            environment = "production"
        else:
            print("Usage: python deploy.py [production|preview]")
            sys.exit(1)
    
    print(f"🎯 Target environment: {environment}")
    
    success = deploy_to_vercel(environment)
    
    if success:
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        print(f"\n🎉 Deployment completed successfully at {timestamp}")
    else:
        print(f"\n💥 Deployment failed. Please check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main() 