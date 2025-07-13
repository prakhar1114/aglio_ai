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

/**
 * Play a success sound using Web Audio API
 */
export function playSuccessSound() {
  try {
    // Create a simple success sound using Web Audio API
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Success sound: quick rising tone
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (error) {
    console.warn('Could not play success sound:', error);
  }
}