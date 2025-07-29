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
 * Parse time string (HH:MM) to minutes since midnight
 * @param {string} timeStr - Time string in HH:MM format
 * @returns {number} - Minutes since midnight
 */
export function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * Check if a menu item is currently available based on its timing data
 * @param {Object} item - Menu item object with timing data
 * @returns {boolean} - True if item is currently available
 */
export function isItemCurrentlyAvailable(item) {
  if (!item.timing) {
    return true; // No timing restrictions, always available
  }

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes(); // Convert to minutes since midnight

  // Handle daily timing (simple start/end format)
  if (item.timing.start && item.timing.end) {
    const startTime = parseTimeToMinutes(item.timing.start);
    const endTime = parseTimeToMinutes(item.timing.end);
    
    if (startTime <= endTime) {
      // Same day timing (e.g., 09:00 to 22:00)
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight timing (e.g., 22:00 to 06:00)
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  // Handle weekly timing (advanced format)
  if (item.timing.monday || item.timing.tuesday || item.timing.wednesday || 
      item.timing.thursday || item.timing.friday || item.timing.saturday || item.timing.sunday) {
    
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const currentDay = dayNames[now.getDay()];
    const dayTiming = item.timing[currentDay];
    
    if (!dayTiming || !dayTiming.start || !dayTiming.end) {
      return false; // Not available on this day
    }
    
    const startTime = parseTimeToMinutes(dayTiming.start);
    const endTime = parseTimeToMinutes(dayTiming.end);
    
    if (startTime <= endTime) {
      // Same day timing
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      // Overnight timing
      return currentTime >= startTime || currentTime <= endTime;
    }
  }

  return true; // Fallback - no valid timing data, assume available
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