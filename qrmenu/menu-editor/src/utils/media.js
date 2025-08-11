export function constructImageUrl(imageUrl, cloudflareImageId, cloudflareVideoId, variant = 'medium', options = {}) {
  // 1. If we have a Cloudflare Video ID, return HLS URL and thumbnail
  if (cloudflareVideoId) {
    const customerCode = import.meta.env?.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE || 'd8d0zszz3k5df3a6';
    
    return {
      type: 'video',
      hls: `https://customer-${customerCode}.cloudflarestream.com/${cloudflareVideoId}/manifest/video.m3u8`,
      thumbnail: `https://customer-${customerCode}.cloudflarestream.com/${cloudflareVideoId}/thumbnails/thumbnail.jpg`,
      id: cloudflareVideoId
    };
  }

  // 2. If we have a Cloudflare Image ID, use Cloudflare Images
  if (cloudflareImageId) {
    const accountHash = import.meta.env.VITE_CLOUDFLARE_IMAGES_ACCOUNT_HASH || 'J-YAzqh0xCiR5OJtQewXmg';
    
    return {
      type: 'image',
      url: `https://imagedelivery.net/${accountHash}/${cloudflareImageId}/${variant}`,
      id: cloudflareImageId
    };
  }

  // 3. Fallback to legacy image URL
  if (imageUrl) {
    return {
      type: 'image',
      url: imageUrl,
      legacy: true
    };
  }

  return null;
}

// Helper function to get the optimal variant based on container size
export function getOptimalVariant(containerWidth, containerHeight = null) {
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
  const effectiveWidth = containerWidth * dpr;
  
  if (effectiveWidth <= 150) return 'thumbnail';
  if (effectiveWidth <= 300) return 'small';
  if (effectiveWidth <= 600) return 'medium';
  return 'large';
} 