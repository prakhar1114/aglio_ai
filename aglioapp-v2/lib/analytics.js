/**
 * Simple analytics module for tracking user interactions with the Ask Aglio chat
 */

// Track events with optional metadata
export function trackEvent(eventName, metadata = {}) {
  // In a real implementation, this would send data to an analytics service
  console.log(`[Analytics] ${eventName}`, metadata);
  
  // Example implementation for future integration with a real analytics service:
  // if (process.env.NODE_ENV === 'production') {
  //   try {
  //     // Send to analytics service
  //     // analyticsService.track(eventName, {
  //     //   ...metadata,
  //     //   timestamp: new Date().toISOString(),
  //     // });
  //   } catch (error) {
  //     console.error('Analytics error:', error);
  //   }
  // }
}

// Chat-specific event tracking functions
export function trackFabOpened() {
  trackEvent('fab_opened');
}

export function trackMessageSent(messageText) {
  trackEvent('message_sent', { 
    messageLength: messageText.length,
    timestamp: new Date().toISOString()
  });
}

export function trackAddFromChat(itemId, itemName) {
  trackEvent('add_from_chat', { 
    itemId,
    itemName
  });
}

// Export a single object for easier mocking in tests
export default {
  trackEvent,
  trackFabOpened,
  trackMessageSent,
  trackAddFromChat
};
