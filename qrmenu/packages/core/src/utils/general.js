import { v4 as uuidv4 } from 'uuid';

// Generate or get device ID from localStorage
export default function getDeviceId() {
    let id = localStorage.getItem("device_id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("device_id", id);
    }
    return id;
  };

  // Generate short thread ID (6 characters)
export function generateShortId() {
  return uuidv4().replace(/-/g, '').substring(0, 6);
  
}

/**
 * Check if a URL is a video based on Cloudflare Stream URLs or file extensions
 * @param {string} url - The URL to check
 * @returns {boolean} - True if the URL is a video
 */
export function isVideoUrl(url) {
  if (!url) return false;
  
  // Check for Cloudflare Stream URLs
  if (url.includes('videodelivery.net') || url.includes('.m3u8')) {
    return true;
  }
  
  // Check for traditional video file extensions
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
  return videoExtensions.some(ext => url.toLowerCase().includes(ext));
}