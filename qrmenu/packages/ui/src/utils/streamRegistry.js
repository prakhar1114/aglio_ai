// Stream Registry Utility
// -----------------------
// Manages references to active Cloudflare <Stream> players so that
// components can reuse existing instances instead of re-creating them.
// NOTE: This is an extremely simple implementation for Phase 1 and will
// evolve with context/transform management and cleanup logic in later phases.

export class StreamRegistry {
  constructor() {
    this.streams = new Map(); // videoId -> { api, lastUsed }
  }

  /**
   * Register a stream reference for a given videoId.
   * @param {string} videoId
   * @param {object} api – API object
   */
  register(videoId, api) {
    if (!videoId || !api) return;
    this.streams.set(videoId, { api, lastUsed: Date.now() });
  }

  /**
   * Retrieve an existing stream reference.
   * @param {string} videoId
   * @returns {object|undefined}
   */
  get(videoId) {
    const entry = this.streams.get(videoId);
    if (entry) entry.lastUsed = Date.now();
    return entry;
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

  cleanup(maxStreams = 10, maxIdleMs = 5 * 60 * 1000) {
    const now = Date.now();
    for (const [id, entry] of this.streams) {
      if (now - entry.lastUsed > maxIdleMs) {
        this.streams.delete(id);
      }
    }

    // enforce maxStreams via LRU
    if (this.streams.size > maxStreams) {
      const sorted = Array.from(this.streams.entries()).sort(
        (a, b) => a[1].lastUsed - b[1].lastUsed,
      );
      const surplus = this.streams.size - maxStreams;
      sorted.slice(0, surplus).forEach(([id]) => {
        this.streams.delete(id);
      });
    }
  }
}

export const streamRegistry = new StreamRegistry(); 