# PreviewScreen Component - Design Document

## Overview

The PreviewScreen is a full-screen modal component that provides an immersive, Instagram-style preview experience for menu items. It emphasizes visual content, seamless navigation, and quick actions while maintaining a clean, modern aesthetic.

## Design Philosophy

### Visual Hierarchy
1. **Image First**: Large, immersive media takes center stage (aspect ratio 3:2)
2. **Minimal Chrome**: Floating UI elements that don't compete with content
3. **Quick Actions**: Prominent but elegant action buttons for immediate engagement
4. **Contextual Discovery**: Related items shown in masonry layout for continued browsing

### Design Language
- **Modern iOS/Instagram-inspired**: Clean, minimal, gesture-driven
- **Glassmorphism**: Floating elements with backdrop blur and transparency
- **Brand Colors**: Red (#E23744) for primary actions, Purple (#8B5CF6) for AI features
- **Typography**: Poppins font family for consistency

## Component Architecture

### Main Structure
```
PreviewScreen
├── Backdrop (blurred overlay)
└── Preview Container
    ├── Header (floating, minimal)
    ├── MediaSection (image/video + progress dots)
    ├── DetailsSection (actions + content)
    └── CategorySection (related items masonry)
```

### Hierarchical Stacking
- Multiple PreviewScreens can stack on top of each other
- Each gets increasing z-index (50, 51, 52...)
- Only topmost screen responds to swipe gestures
- Back navigation pops from preview stack

## Visual Design Specifications

### Header Design
```css
/* Floating Back Button */
- Position: Absolute top-left with safe area padding
- Size: 44x44px (44pt touch target)
- Background: White with 95% opacity + backdrop blur
- Border: 1px solid rgba(255,255,255,0.2)
- Shadow: Subtle drop shadow
- Icon: 20x20px chevron, 2.5px stroke weight
- Hover: Scale to 105%, full opacity
```

### Progress Dots
```css
/* Instagram-style Progress Indicators */
- Position: Bottom center of media section
- Size: 8x8px circles
- Colors: White (active), White 50% opacity (inactive)
- Spacing: 8px between dots
- Max visible: 5 dots with smart positioning logic
- Animation: 300ms smooth transitions
```

### Media Section
```css
/* Hero Image/Video Display */
- Aspect Ratio: 3:2 (optimal for food photography)
- Object Fit: Cover (maintains aspect, crops if needed)
- Background: Light gray (#F3F4F6) for loading state
- Fallback: Food emoji (🍽️) at 96px size
- Video: Auto-play, loop, muted, no controls
```

### Action Buttons Design

#### Add to Cart Button
```css
/* Primary Action - Zero State */
- Background: Brand red (#E23744)
- Size: 36px height, minimum 36px width
- Border Radius: 8px
- Icon: Plus (+) symbol, 16x16px, 2.5px stroke
- Shadow: 0 2px 4px rgba(226,55,68,0.2)

/* Primary Action - Quantity State */
- Layout: [-] [quantity] [+] pill design
- Background: Same brand red
- Buttons: 36px height, transparent background
- Typography: Poppins 600 weight, 14px quantity, 16px buttons
```

#### Ask AI Button
```css
/* Secondary Action */
- Background: Purple (#8B5CF6)
- Size: 36px height, minimum 80px width
- Icon: Sparkle (✨) emoji + "Ask AI" text
- Typography: Poppins 600, 14px
- Shadow: 0 2px 4px rgba(139,92,246,0.2)
```

### Content Layout
```css
/* Details Section */
- Padding: 16px horizontal
- Name: 20px Poppins 700, #111827
- Price: 18px Poppins 700, brand red
- Description: 14px Poppins 400, #6B7280, line-height 1.5
- Actions: Top placement for thumb accessibility
```

## Interaction Patterns

### Swipe Navigation
- **Left Swipe**: Next item in same category (circular)
- **Right Swipe**: Previous item in same category (circular)
- **Threshold**: 50px minimum swipe distance
- **Visual Feedback**: None (instant navigation)
- **Desktop**: Mouse drag support for testing

### Touch Handling
```javascript
// Using react-swipeable library
{
  onSwipedLeft: navigateToNext,
  onSwipedRight: navigateToPrevious,
  trackMouse: true,        // Desktop support
  trackTouch: true,        // Mobile support
  delta: 50,               // Minimum distance
  preventScrollOnSwipe: false  // Allow vertical scroll
}
```

### Category Item Interaction
- **Touch Target**: Full card area
- **Response**: Opens new PreviewScreen on stack
- **Event Handling**: stopPropagation to prevent parent swipe interference
- **Layout**: SimpleMasonryGrid with CSS columns

## Responsive Design

### Breakpoints
```css
/* Column Count Logic */
< 250px: 1 column
< 350px: 2 columns  
≥ 350px: 3 columns

/* Container Constraints */
Max Width: 428px (iPhone Plus/Pro Max)
Padding: 4px horizontal (minimal breathing room)
```

### Safe Areas
- Header positioning accounts for status bar
- Bottom navigation avoids home indicator
- Content scrolling respects system UI

## State Management Integration

### Cart Integration
```javascript
// Zustand store connections
const qty = useCartStore(s => s.items[item.id]?.qty ?? 0);
const addItem = useCartStore(s => s.addItem);
const removeItem = useCartStore(s => s.removeItem);
```

### AI Chat Integration
```javascript
// Pre-composed messages
const handleAskAI = (item) => {
  const message = `Tell me more about ${item.name}`;
  sendMessageAndOpenChat(message);
};
```

### Preview Stack Management
```javascript
// Hierarchical navigation
- previewStack: Array of preview states
- zIndex: 50 + stack position
- isTopmost: Only top responds to gestures
- onClose: Pops from stack, preserves scroll for main feed
```

## Performance Considerations

### Image Loading
- Lazy loading for media content
- Optimized aspect ratios prevent layout shift
- Placeholder states for slow connections

### Scroll Performance
- CSS transforms for smooth animations
- Minimal DOM manipulation during swipes
- Preserved scroll positions for navigation

### Memory Management
- Components unmount when popped from stack
- Event listeners cleaned up properly
- No memory leaks from touch handlers

## Accessibility Features

### Touch Targets
- Minimum 44px touch targets (iOS guidelines)
- Clear visual feedback on interaction
- Sufficient spacing between interactive elements

### Screen Readers
- Semantic HTML structure
- Descriptive button labels
- Progress indication for navigation

### Keyboard Navigation
- Tab order follows visual hierarchy
- Enter/Space for primary actions
- Escape key for closing

## Component Linking & Integration

### Props Interface
```javascript
PreviewScreen({
  isOpen: boolean,           // Visibility state
  item: MenuItem,            // Current item data
  categoryItems: MenuItem[], // Items for swipe navigation
  currentIndex: number,      // Position in category
  onClose: () => void,       // Close handler
  onItemChange: (index) => void,  // Swipe navigation
  onItemClick: (item) => void,    // Hierarchical preview
  zIndex: number = 50,       // Stacking order
  isTopmost: boolean = true  // Gesture responsiveness
})
```

### Parent Component Integration
```javascript
// MenuScreen.jsx integration
const [previewStack, setPreviewStack] = useState([]);

const openPreview = (item, items) => {
  const newPreview = {
    item,
    categoryItems: items,
    currentIndex: items.findIndex(i => i.id === item.id)
  };
  setPreviewStack(prev => [...prev, newPreview]);
};

const closeTopPreview = () => {
  setPreviewStack(prev => prev.slice(0, -1));
};
```

### SimpleMasonryGrid Integration
```javascript
// Category section uses masonry layout
<SimpleMasonryGrid
  items={otherItems}
  onItemClick={handleItemClick}
  title={`Other ${currentItem.category_brief}`}
  className="flex-1"
/>
```

## Animation & Transitions

### Entry Animation
```css
@keyframes slide-in-right {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}
```

### Micro-interactions
- Button hover: Scale 105%, opacity changes
- Progress dots: 300ms smooth transitions
- Backdrop blur: Instant, performant

## Error Handling & Edge Cases

### Data Validation
- Graceful fallbacks for missing images
- Safe navigation for empty categories
- Prevents crashes from malformed data

### Network Failures
- Placeholder states for loading images
- Retry mechanisms for failed requests
- Offline state indicators

### User Experience Edge Cases
- Single item categories (no swipe needed)
- Very long item names (text truncation)
- Rapid gesture handling (debouncing)

## Future Enhancement Opportunities

### Advanced Features
- Zoom/pinch for images
- Social sharing integration
- Favorite/bookmark functionality
- Nutritional information overlay

### Performance Optimizations
- Virtual scrolling for large categories
- Image lazy loading with intersection observer
- Bundle size optimization

### Accessibility Improvements
- Voice control integration
- High contrast mode support
- Reduced motion preferences

## Development Guidelines

### Code Organization
- Separate sub-components for maintainability
- Consistent prop naming conventions
- Comprehensive TypeScript interfaces (future)

### Testing Strategy
- Unit tests for component logic
- Integration tests for swipe handling
- Visual regression tests for design consistency

### Documentation
- Storybook stories for component variants
- API documentation for props
- Design system integration guides 