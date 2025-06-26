# Cloudflare Integration Setup

This document describes how to set up Cloudflare Images and Stream integration for the QRMenu application.

## Overview

The application integrates with two Cloudflare services:
- **Cloudflare Images**: For image optimization and global CDN delivery
- **Cloudflare Stream**: For video hosting and adaptive streaming

## Required Environment Variables

Add these environment variables to your backend configuration:

```bash
# Cloudflare Account Configuration
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_HASH=your_account_hash_here
```

### Frontend Environment Variables

Add this to your frontend `.env` file (for qrmenu packages):

```bash
# Cloudflare Configuration  
VITE_CLOUDFLARE_ACCOUNT_HASH=your_account_hash_here
```

## Setting Up Cloudflare

### 1. Create Cloudflare Account
1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Note your Account ID from the dashboard

### 2. Get API Token
1. Go to Cloudflare Dashboard > My Profile > API Tokens
2. Create a Custom Token with these permissions:
   - Account: `Cloudflare Images:Edit`
   - Account: `Cloudflare Stream:Edit`
   - Zone Resources: `Include All zones`

### 3. Enable Cloudflare Images
1. Go to Cloudflare Dashboard > Images
2. Enable Cloudflare Images for your account
3. Note the Account Hash from the Images dashboard

### 4. Enable Cloudflare Stream  
1. Go to Cloudflare Dashboard > Stream
2. Enable Cloudflare Stream for your account

## Usage

### During Restaurant Onboarding

When running the onboarding script, images and videos will be automatically uploaded to Cloudflare:

```bash
python backend/scripts/1_onboard_restaurants.py /path/to/restaurant_folder
```

The script will:
1. Download images/videos from URLs (if provided)
2. Upload media files to appropriate Cloudflare services
3. Store Cloudflare IDs in the database
4. Generate embeddings for AI recommendations

### URL Generation

The system uses a priority-based URL generation:

1. **Cloudflare Stream video** (highest priority) - for `.m3u8` HLS streams
2. **Cloudflare Images** - for optimized image delivery
3. **Legacy image paths** (fallback) - for existing local images

### Frontend Integration

The frontend automatically handles both image and video content:

```javascript
// Images served via Cloudflare Images
https://imagedelivery.net/{account_hash}/{image_id}/public

// Videos served via Cloudflare Stream  
https://videodelivery.net/{video_id}/manifest/video.m3u8
```

## Benefits

- **Global CDN**: Images and videos served from edge locations worldwide
- **Automatic Optimization**: Images automatically resized and optimized for device/browser
- **Adaptive Streaming**: Videos automatically adapt quality based on bandwidth
- **Reduced Backend Load**: Static content served directly from Cloudflare
- **Better Performance**: Faster loading times, especially on mobile devices

## Migration from Local Storage

Existing restaurants with local images will continue to work during the transition. The system supports both:

- New restaurants: Cloudflare-first approach
- Existing restaurants: Legacy image paths with gradual migration

To migrate an existing restaurant to Cloudflare:

1. Re-run the onboarding script with the `--force-upload` flag (when implemented)
2. Or manually update the database with Cloudflare IDs

## Cost Considerations

- **Cloudflare Images**: Pay per image stored and delivered
- **Cloudflare Stream**: Pay per minute of video stored and viewed
- Monitor usage via Cloudflare Dashboard > Billing

## Troubleshooting

### Upload Failures
- Check API token permissions
- Verify account ID and hash are correct  
- Ensure file formats are supported (Images: JPG, PNG, GIF, WebP; Stream: MP4, MOV, etc.)

### Missing Images/Videos
- Fallback to legacy URLs if Cloudflare IDs are missing
- Check browser console for 404 errors
- Verify environment variables are set correctly

### HLS Video Playback
- Modern browsers support HLS natively
- For older browsers, consider adding HLS.js library
- Cloudflare Stream provides adaptive bitrate streaming automatically 