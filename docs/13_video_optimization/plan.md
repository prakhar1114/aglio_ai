# Cloudflare Stream Optimization Plan

## Overview
This document outlines the comprehensive plan to optimize video streaming performance by replacing iframe-based video players with the `@cloudflare/stream-react` package and implementing stream reuse across components.

## Current State Analysis

### OptimizedMedia Usage Patterns
1. **MasonryFeed** → **FeedItemSwitcher** → **ItemCard** → **OptimizedMedia** (autoplay=true, preload=true, muted=true)
2. **SimpleMasonryGrid** → **FeedItemSwitcher** → **ItemCard** → **OptimizedMedia** (no autoplay/preload by default)
3. **PreviewScreen** → **MediaSection** → **OptimizedMedia** (addControls=true, autoplay=true, preload=true)
4. **CartDrawer** → **OptimizedMedia** (48x48 thumbnails, enableHoverVideo=false)
5. **BlockRenderer** → **DishCard** → **OptimizedMedia** (chat blocks, enableHoverVideo=true)

### Key Performance Bottleneck
The transition from **MasonryFeed** → **PreviewScreen** where the same video should continue playing without reinitialization.

## Implementation Plan

### Phase 1: Core Stream Infrastructure
**Goal:** Replace iframe with `@cloudflare/stream-react` and establish stream management

#### 1.1 Dependencies
- Install `@cloudflare/stream-react`
- Update package.json

#### 1.2 StreamPlayerWrapper Component
Create a memoized wrapper component that:
- Uses `@cloudflare/stream-react` instead of iframe
- Supports CSS transformations without re-rendering
- Provides imperative API for stream control
- Handles loading states and error handling

#### 1.3 StreamRegistry System
Implement a global registry that:
- Tracks active streams by videoId
- Manages stream contexts and transformations
- Handles memory cleanup and garbage collection
- Provides stream reuse capabilities

### Phase 2: Enhanced OptimizedMedia Component
**Goal:** Seamless integration with existing components

#### 2.1 Backward Compatibility
- Maintain all existing props and behavior
- Add new `reuseStream` prop
- Add `contextId` for stream identification
- Add `transformations` for CSS transforms

#### 2.2 Stream Management
- Integrate with StreamRegistry
- Handle stream registration and cleanup
- Support both new and legacy usage patterns

### Phase 3: Seamless Feed to Preview Transition
**Goal:** Zero-lag video continuation

#### 3.1 Context Passing
- ItemCard passes stream context to PreviewScreen
- PreviewScreen inherits and continues stream
- Smooth zoom/translation animations

#### 3.2 Transform Animations
- CSS-based transforms for smooth transitions
- 60fps animations using transform properties
- No stream re-rendering during transitions

### Phase 4: Stream Reuse in SimpleMasonryGrid
**Goal:** Extend reuse to category sections

#### 4.1 CategorySection Enhancement
- Enable stream reuse in SimpleMasonryGrid
- Proper context management for category items
- Seamless transitions between related items

#### 4.2 FeedItemSwitcher Integration
- Support for stream reuse parameters
- Context ID propagation through component tree

### Phase 5: Memory Management & Persistence
**Goal:** Efficient memory usage and session persistence

#### 5.1 Session Persistence
- Save stream states to sessionStorage
- Restore stream positions on page reload
- Maintain playback continuity across sessions

#### 5.2 Memory Management
- Limit concurrent streams (max 10)
- Cleanup unused streams after 5 minutes
- LRU eviction for memory efficiency

## Technical Implementation Details

### StreamPlayerWrapper Architecture
```jsx
const StreamPlayerWrapper = memo(forwardRef(({
  videoId, 
  containerWidth, 
  containerHeight, 
  addControls, 
  preload, 
  autoplay, 
  muted,
  transformations = {},
  onStreamReady,
  className
}, ref) => {
  // Stream ref for imperative API
  // Transform handling
  // Event management
}));
```

### StreamRegistry Design
```jsx
class StreamRegistry {
  streams = new Map(); // videoId -> { streamRef, contexts, lastUsed }
  contexts = new Map(); // contextId -> { videoId, transformations }
  
  // Stream registration and management
  // Transformation updates
  // Memory cleanup
}
```

### Transform System
- CSS transforms for zoom, translation, rotation
- Smooth animations with configurable duration
- Transform origin control for proper scaling
- No re-rendering during transformations

## Performance Benefits

### Expected Improvements
1. **Zero-lag transitions**: Videos continue playing seamlessly between contexts
2. **Memory efficiency**: Limited concurrent streams with intelligent cleanup
3. **Bandwidth optimization**: Single stream instance reused across contexts
4. **Smooth animations**: CSS transforms provide 60fps transitions
5. **Session persistence**: Stream states survive page reloads

### Memory Management
- Maximum 10 concurrent streams
- 5-minute idle timeout for unused streams
- LRU eviction for memory pressure
- Session storage for state persistence

## Implementation Timeline

### Phase 1 (Week 1): Core Infrastructure
- Install `@cloudflare/stream-react`
- Create `StreamPlayerWrapper` component
- Create `StreamRegistry` system
- Basic transformation support

### Phase 2 (Week 1-2): OptimizedMedia Integration
- Update `OptimizedMedia.jsx` to use new system
- Maintain backward compatibility
- Add `reuseStream` prop support

### Phase 3 (Week 2): Feed to Preview Transition
- Implement seamless transition in `PreviewScreen`
- Update `ItemCard` to pass stream context
- Add zoom/translation animations

### Phase 4 (Week 2-3): SimpleMasonryGrid Integration
- Extend reuse to `CategorySection`
- Update `SimpleMasonryGrid` and `FeedItemSwitcher`
- Test performance across all usage patterns

### Phase 5 (Week 3): Memory Management
- Implement session persistence
- Add memory cleanup strategies
- Performance optimization and testing

## Testing Strategy

### Performance Metrics
- Transition lag: Target < 100ms (ideally 0ms)
- Memory usage: Max 10 concurrent streams
- User experience: Smooth 60fps animations
- Battery impact: Minimal additional drain

### Test Scenarios
1. **Feed to Preview**: Click item in MasonryFeed → open PreviewScreen
2. **Preview Navigation**: Swipe between items in PreviewScreen
3. **Category Browsing**: Navigate through SimpleMasonryGrid items
4. **Memory Pressure**: Test with many concurrent streams
5. **Session Persistence**: Reload page and verify stream continuity

### Success Criteria
- Smooth transitions without video reloading
- Memory usage stays within bounds
- No performance degradation on mobile devices
- Consistent user experience across all contexts

## Potential Challenges

### Technical Challenges
1. **Event handling**: Ensuring touch/swipe events work with transformed streams
2. **State synchronization**: Keeping play state consistent across contexts
3. **Mobile performance**: CSS transforms + video playback optimization
4. **Memory leaks**: Proper cleanup of stream references
5. **Error handling**: Graceful fallbacks for unsupported browsers

### Mitigation Strategies
- Comprehensive testing on various devices
- Fallback to iframe-based approach if needed
- Progressive enhancement approach
- Extensive error handling and logging

## Future Enhancements

### Phase 6+: Advanced Features
- Picture-in-picture support
- Advanced video analytics
- Adaptive streaming based on network conditions
- Custom video controls and overlays
- Integration with video recommendation engine

### Performance Optimizations
- WebAssembly for video processing
- Service worker for video caching
- Intersection Observer for lazy loading
- Advanced prefetching strategies
