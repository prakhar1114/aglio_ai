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