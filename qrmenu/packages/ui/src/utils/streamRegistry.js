// Stream Registry Utility
// -----------------------
// Manages references to active Cloudflare <Stream> players so that
// components can reuse existing instances instead of re-creating them.
// NOTE: This is an extremely simple implementation for Phase 1 and will
// evolve with context/transform management and cleanup logic in later phases.

export class StreamRegistry {
  constructor() {
    this.streams = new Map(); // videoId -> streamRef
  }

  /**
   * Register a stream reference for a given videoId.
   * @param {string} videoId
   * @param {object} streamRef – reference returned by <Stream>
   */
  register(videoId, streamRef) {
    if (!videoId || !streamRef) return;
    this.streams.set(videoId, streamRef);
  }

  /**
   * Retrieve an existing stream reference.
   * @param {string} videoId
   * @returns {object|undefined}
   */
  get(videoId) {
    return this.streams.get(videoId);
  }

  has(videoId) {
    return this.streams.has(videoId);
  }

  /**
   * Remove a cached stream reference (for explicit cleanup).
   * @param {string} videoId
   */
  remove(videoId) {
    this.streams.delete(videoId);
  }
}

export const streamRegistry = new StreamRegistry(); 