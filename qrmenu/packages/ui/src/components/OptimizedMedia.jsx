import React from 'react';
import { constructImageUrl, getOptimalVariant } from '@qrmenu/core';

export function OptimizedMedia({ 
  imageUrl,
  cloudflareImageId,
  cloudflareVideoId,
  alt = '',
  className = '',
  containerWidth = 300,
  containerHeight = null,
  onClick = null
}) {

  // Get optimal variant based on container size (DPI-aware)
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const optimalVariant = getOptimalVariant(containerWidth * devicePixelRatio);
  console.log("containerWidth", containerWidth)
  console.log("optimalVariant", optimalVariant)
  
  // Construct media URLs
  const mediaResult = constructImageUrl(
    imageUrl,
    cloudflareImageId,
    cloudflareVideoId,
    optimalVariant
  );
  
  if (!mediaResult) {
    // Fallback placeholder
    console.warn("This should never happen")
    return (
      <div 
        className={`
          flex items-center justify-center
          bg-gradient-to-br from-gray-50 to-gray-100
          ${className}
        `}
        style={{ 
          width: containerWidth, 
          height: containerHeight || 'auto',
          minHeight: containerHeight ? containerHeight : 200 // Reasonable fallback
        }}
      >
        <div className="text-gray-400 text-center">
          <div className="w-8 h-8 mx-auto mb-2 bg-gray-200 rounded-full flex items-center justify-center">
            🍽️
          </div>
          <span className="text-xs">No image</span>
        </div>
      </div>
    );
  }
  
  // Handle video with iframe
  if (mediaResult.type === 'video') {
    return (
      <div 
        className={`relative ${className} ${onClick ? 'cursor-pointer' : ''}`}
        style={{ 
          width: containerWidth,
          height: containerHeight,
          maxWidth: '100%'
        }}
        onClick={onClick}
      >
        <iframe
          src={`${mediaResult.iframe}`}
          className="absolute inset-0 w-full h-full"
          style={{ 
            border: 'none', 
            pointerEvents: 'none', // Always disable pointer events to allow parent swipe detection
            zIndex: 1 // Lower z-index to allow buttons to be on top
          }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }
  
  // Handle image
  return (
    <img
      src={mediaResult.url}
      alt={alt}
      className={`w-full h-full object-cover ${className} ${onClick ? 'cursor-pointer' : ''}`}
      style={{ 
        width: containerWidth, 
        height: containerHeight || 'auto',
        maxWidth: '100%'
      }}
      onClick={onClick}
    />
  );
} 