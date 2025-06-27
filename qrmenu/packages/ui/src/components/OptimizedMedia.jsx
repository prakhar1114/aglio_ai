import React, { useRef, useEffect, useState } from 'react';
import { constructImageUrl, getOptimalVariant } from '@qrmenu/core';
import Hls from 'hls.js';

export function OptimizedMedia({ 
  imageUrl,
  cloudflareImageId,
  cloudflareVideoId,
  alt = '',
  className = '',
  containerWidth = 300,
  containerHeight = null,
  onClick = null,
  addControls = false
}) {

  // Get optimal variant based on container size (DPI-aware)
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const optimalVariant = getOptimalVariant(containerWidth * devicePixelRatio);
  // console.log("containerWidth", containerWidth);
  // console.log("optimalVariant", optimalVariant);
  
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
  
  // Handle video with HLS
  if (mediaResult.type === 'video') {
    return (
      <VideoPlayer 
        hlsUrl={mediaResult.hls}
        thumbnailUrl={mediaResult.thumbnail}
        className={className}
        containerWidth={containerWidth}
        containerHeight={containerHeight}
        onClick={onClick}
        alt={alt}
        addControls={addControls}
      />
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
      loading="lazy"
    />
  );
}

// VideoPlayer component with HLS support and thumbnail optimization
function VideoPlayer({ hlsUrl, thumbnailUrl, className, containerWidth, containerHeight, onClick, alt, addControls = false }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hlsUrl) return;

    // Check if browser supports HLS natively (Safari)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support
      video.src = hlsUrl;
      video.addEventListener('canplay', handleVideoCanPlay);
    } else if (Hls.isSupported()) {
      // Use HLS.js for other browsers
      const hls = new Hls({
        enableWorker: false // Disable worker to avoid CORS issues in some environments
      });
      hlsRef.current = hls;
      
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // HLS manifest loaded, video is ready to play
      });

      video.addEventListener('canplay', handleVideoCanPlay);
    } else {
      console.warn('HLS is not supported in this browser');
      // Keep thumbnail visible as fallback
    }

    function handleVideoCanPlay() {
      setVideoLoaded(true);
      setIsLoading(false);
      // Small delay to ensure smooth transition
      setTimeout(() => {
        setShowThumbnail(false);
      }, 100);
    }

    // Cleanup
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      if (video) {
        video.removeEventListener('canplay', handleVideoCanPlay);
      }
    };
  }, [hlsUrl]);

  const toggleMute = (e) => {
    e.stopPropagation(); // Prevent triggering parent onClick
    const video = videoRef.current;
    if (video) {
      video.muted = !video.muted;
      setIsMuted(video.muted);
    }
  };

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
      {/* Thumbnail - shown initially and hidden when video loads */}
      {showThumbnail && (
        <img
          src={thumbnailUrl}
          alt={alt}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ 
            zIndex: 2,
            transition: 'opacity 0.3s ease-in-out'
          }}
        />
      )}
      
      {/* Video element */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ 
          pointerEvents: 'none', // Disable pointer events to allow parent swipe detection
          zIndex: 1,
          opacity: videoLoaded && !showThumbnail ? 1 : 0,
          transition: 'opacity 0.3s ease-in-out'
        }}
        muted
        autoPlay
        loop
        playsInline
        preload="auto"
      />

      {/* Video Controls - only show if addControls is true */}
      {addControls && (
        <div className="absolute bottom-3 right-3 z-10">
          {/* Loading indicator */}
          {isLoading && (
            <div className="w-8 h-8 bg-black bg-opacity-60 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          
          {/* Mute/Unmute button */}
          {!isLoading && (
            <button
              onClick={toggleMute}
              className="w-8 h-8 bg-black bg-opacity-60 backdrop-blur-sm rounded-full flex items-center justify-center text-white hover:bg-opacity-80 transition-all duration-200 shadow-lg active:scale-95"
              style={{ pointerEvents: 'auto' }} // Enable pointer events for this button
            >
              {isMuted ? (
                // Muted icon (more refined)
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                </svg>
              ) : (
                // Unmuted icon (more refined)
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                </svg>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
} 