# PreviewScreen Implementation Details

## Overview
A fullscreen preview modal that opens when users click on ItemCard components. It displays the item's details, allows navigation through items in the same category via swipe gestures, and provides quick actions like "Add to Cart" and "Ask AI".

## File Structure
```
qrmenu/packages/ui/src/
├── screens/
│   ├── MenuScreen.jsx          # Updated to handle preview state
│   └── PreviewScreen.jsx       # New component
└── components/
    ├── MasonryFeed.jsx         # Updated to pass onItemClick
    ├── ItemCard.jsx            # Updated to handle clicks
    └── FeedItemSwitcher.jsx    # Updated to pass props
```

## Component Architecture

### PreviewScreen.jsx Props
```javascript
{
  isOpen: boolean,
  item: object,               // Current item being previewed
  categoryItems: array,       // All items from the same category
  currentIndex: number,       // Index of current item in categoryItems
  onClose: function,          // Close preview and restore scroll
  onItemChange: function,     // Called when swiping to different item
  onAskAI: function          // Open AI chat with pre-filled message
}
```

### MenuScreen.jsx State Addition
```javascript
const [previewState, setPreviewState] = useState({
  isOpen: false,
  item: null,
  categoryItems: [],
  currentIndex: 0,
  scrollOffset: null
});
```

## Implementation Steps

### Step 1: PreviewScreen Component Structure

```javascript
// PreviewScreen.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useCartStore } from '@qrmenu/core';
import { ItemCard } from '../components/ItemCard.jsx';

export function PreviewScreen({ 
  isOpen, 
  item, 
  categoryItems, 
  currentIndex, 
  onClose, 
  onItemChange, 
  onAskAI 
}) {
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // Layout structure with sections
  return (
    <div className="preview-screen-overlay">
      <Header onClose={onClose} />
      <MediaSection item={item} />
      <DetailsSection item={item} onAskAI={onAskAI} />
      <CategorySection categoryItems={categoryItems} currentItem={item} />
    </div>
  );
}
```

### Step 2: MenuScreen Integration

```javascript
// MenuScreen.jsx updates
import { PreviewScreen } from './PreviewScreen.jsx';

function MenuPage() {
  const virtuosoRef = useRef(null);
  
  // Add preview state
  const [previewState, setPreviewState] = useState({
    isOpen: false,
    item: null,
    categoryItems: [],
    currentIndex: 0,
    scrollOffset: null
  });

  const handleItemClick = (clickedItem, allCurrentItems) => {
    // Capture scroll position
    const scrollState = virtuosoRef.current?.getState();
    
    // Filter items by same category
    const categoryItems = allCurrentItems.filter(
      item => item.category_brief === clickedItem.category_brief
    );
    
    // Find index of clicked item
    const currentIndex = categoryItems.findIndex(
      item => item.id === clickedItem.id
    );
    
    setPreviewState({
      isOpen: true,
      item: clickedItem,
      categoryItems,
      currentIndex,
      scrollOffset: scrollState
    });
  };

  const handlePreviewClose = () => {
    setPreviewState(prev => ({ ...prev, isOpen: false }));
    
    // Restore scroll position after animation
    setTimeout(() => {
      if (previewState.scrollOffset && virtuosoRef.current) {
        virtuosoRef.current.scrollTo(previewState.scrollOffset);
      }
    }, 300);
  };

  const handleItemChange = (newIndex) => {
    const newItem = previewState.categoryItems[newIndex];
    setPreviewState(prev => ({
      ...prev,
      item: newItem,
      currentIndex: newIndex
    }));
  };

  const handleAskAI = (item) => {
    // Pre-compose AI message
    const message = `Tell me more about ${item.name}`;
    // Open AI chat with pre-filled message
    setIsAIChatOpen(true);
    // TODO: Pass message to AIChatDrawer
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Existing content */}
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <main className="flex-1">
          <MasonryFeed 
            ref={virtuosoRef}
            filters={currentFilters}
            onItemClick={handleItemClick}
          />
        </main>
      </div>

      {/* Existing drawers... */}

      {/* Preview Screen */}
      <PreviewScreen
        isOpen={previewState.isOpen}
        item={previewState.item}
        categoryItems={previewState.categoryItems}
        currentIndex={previewState.currentIndex}
        onClose={handlePreviewClose}
        onItemChange={handleItemChange}
        onAskAI={handleAskAI}
      />
    </div>
  );
}
```

### Step 3: MasonryFeed Props Flow

```javascript
// MasonryFeed.jsx
export function MasonryFeed({ filters = {}, gap = 2, onItemClick, ref }) {
  // Forward ref to virtuoso
  const virtuosoRef = useRef(null);
  
  React.useImperativeHandle(ref, () => ({
    getState: () => virtuosoRef.current?.getState(),
    scrollTo: (state) => virtuosoRef.current?.scrollTo(state)
  }));

  // Pass all current filtered items to onItemClick
  const handleItemClick = (item) => {
    const allCurrentItems = data ? data.pages.flatMap(p => p.items) : [];
    onItemClick?.(item, allCurrentItems);
  };

  // In itemContent render:
  return (
    <FeedItemSwitcher 
      item={item} 
      onItemClick={handleItemClick}
    />
  );
}
```

### Step 4: ItemCard Click Handler

```javascript
// ItemCard.jsx updates
export function ItemCard({ item, onItemClick }) {
  const handleCardClick = (e) => {
    // Don't trigger if clicking on add/remove buttons
    if (e.target.closest('button')) return;
    
    onItemClick?.(item);
  };

  return (
    <div 
      style={cardStyle} 
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
    >
      {/* Existing content */}
    </div>
  );
}
```

### Step 5: PreviewScreen Layout Implementation

```javascript
// PreviewScreen.jsx detailed implementation
export function PreviewScreen({ 
  isOpen, 
  item, 
  categoryItems, 
  currentIndex, 
  onClose, 
  onItemChange, 
  onAskAI 
}) {
  // Swipe handling state
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  
  const containerRef = useRef(null);

  // Helper function to check if URL is video
  const isVideoUrl = (url) => {
    if (!url) return false;
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
    return videoExtensions.some(ext => url.toLowerCase().includes(ext));
  };

  if (!isOpen || !item) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      
      {/* Preview Container */}
      <div 
        ref={containerRef}
        className="fixed inset-0 z-50 bg-white flex flex-col"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <Header onClose={onClose} />
        
        {/* Media Section */}
        <MediaSection item={item} />
        
        {/* Details Section */}
        <DetailsSection item={item} onAskAI={onAskAI} />
        
        {/* Category Items Section */}
        <CategorySection 
          categoryItems={categoryItems} 
          currentItem={item} 
          onItemClick={(clickedItem) => {
            const newIndex = categoryItems.findIndex(i => i.id === clickedItem.id);
            onItemChange(newIndex);
          }}
        />
      </div>
    </>
  );
}
```

### Step 6: Continuous Swipe Navigation (Updated)

```javascript
// Swipe handling functions in PreviewScreen.jsx
const handleTouchStart = (e) => {
  setStartX(e.touches[0].clientX);
  setCurrentX(e.touches[0].clientX);
  setIsDragging(true);
};

const handleTouchMove = (e) => {
  if (!isDragging) return;
  
  const currentTouch = e.touches[0].clientX;
  const diff = currentTouch - startX;
  
  setCurrentX(currentTouch);
  setTranslateX(diff);
};

const handleTouchEnd = (e) => {
  if (!isDragging) return;
  
  const diff = currentX - startX;
  const threshold = 50; // Minimum swipe distance
  
  setIsDragging(false);
  setTranslateX(0);
  
  if (Math.abs(diff) > threshold) {
    if (diff > 0) {
      // Swiped right - go to previous item
      navigateToPrevious();
    } else {
      // Swiped left - go to next item
      navigateToNext();
    }
  }
};

const navigateToNext = () => {
  const nextIndex = (currentIndex + 1) % categoryItems.length;
  onItemChange(nextIndex);
};

const navigateToPrevious = () => {
  const prevIndex = currentIndex === 0 
    ? categoryItems.length - 1 
    : currentIndex - 1;
  onItemChange(prevIndex);
};

// Continuous navigation: 
// - After last item (index = length-1), next goes to index 0
// - Before first item (index = 0), previous goes to index length-1
// - User can keep swiping infinitely through the category items
```

### Step 7: Component Sections

```javascript
// Header Component
function Header({ onClose }) {
  return (
    <div className="flex items-center justify-between p-4 border-b bg-white sticky top-0 z-10">
      <button
        onClick={onClose}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span>Back</span>
      </button>
    </div>
  );
}

// Media Section Component
function MediaSection({ item }) {
  const isVideo = isVideoUrl(item.image_url);
  
  return (
    <div className="aspect-[3/2] w-full bg-gray-100 flex items-center justify-center">
      {item.image_url ? (
        isVideo ? (
          <video
            src={item.image_url}
            className="w-full h-full object-cover"
            autoPlay
            loop
            muted
            playsInline
            controls={false}
          />
        ) : (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        )
      ) : (
        <div className="text-gray-400 text-4xl">🍽️</div>
      )}
    </div>
  );
}

// Details Section Component
function DetailsSection({ item, onAskAI }) {
  const qty = useCartStore((s) => s.items[item.id]?.qty ?? 0);
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);

  return (
    <div className="p-4 space-y-4">
      {/* Name and Price */}
      <div className="flex items-start justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex-1 mr-4">
          {item.name}
        </h1>
        <span className="text-lg font-bold text-red-500">
          ₹{item.price}
        </span>
      </div>

      {/* Description */}
      {item.description && (
        <p className="text-gray-600 text-sm leading-relaxed">
          {item.description}
        </p>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        {/* Add to Cart Button */}
        <div className="flex-1">
          {qty === 0 ? (
            <button
              onClick={() => addItem(item)}
              className="w-full bg-red-500 text-white py-3 px-4 rounded-lg font-semibold hover:bg-red-600 transition-colors"
            >
              Add to Cart
            </button>
          ) : (
            <div className="flex items-center justify-between bg-red-500 text-white py-3 px-4 rounded-lg">
              <button
                onClick={() => removeItem(item)}
                className="text-white hover:bg-red-600 px-2 py-1 rounded"
              >
                −
              </button>
              <span className="font-semibold">{qty}</span>
              <button
                onClick={() => addItem(item)}
                className="text-white hover:bg-red-600 px-2 py-1 rounded"
              >
                +
              </button>
            </div>
          )}
        </div>

        {/* Ask AI Button */}
        <button
          onClick={() => onAskAI(item)}
          className="bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
        >
          Ask AI
        </button>
      </div>
    </div>
  );
}

// Category Section Component
function CategorySection({ categoryItems, currentItem, onItemClick }) {
  const otherItems = categoryItems.filter(item => item.id !== currentItem.id);
  
  if (otherItems.length === 0) return null;

  return (
    <div className="p-4 flex-1 overflow-hidden">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        Other {currentItem.category_brief}
      </h2>
      
      <div className="flex space-x-3 overflow-x-auto pb-4">
        {otherItems.map((item) => (
          <div 
            key={item.id} 
            className="w-40 flex-shrink-0"
            onClick={() => onItemClick(item)}
          >
            <ItemCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Step 8: AIChatDrawer Integration

```javascript
// Update AIChatDrawer to accept pre-filled message
export function AIChatDrawer({ isOpen, onClose, initialMessage = '' }) {
  const [inputMessage, setInputMessage] = useState(initialMessage);
  
  useEffect(() => {
    setInputMessage(initialMessage);
  }, [initialMessage]);

  // Rest of implementation...
}

// In MenuScreen.jsx
const handleAskAI = (item) => {
  const message = `Tell me more about ${item.name}`;
  setAIChatInitialMessage(message);
  setIsAIChatOpen(true);
};
```

## Styling Considerations

### CSS Classes Needed
```css
/* Add to global.css or styles.css */
.preview-screen-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: white;
  display: flex;
  flex-direction: column;
}

.preview-screen-overlay.entering {
  animation: slideInFromRight 0.3s ease-out;
}

.preview-screen-overlay.exiting {
  animation: slideOutToRight 0.3s ease-out;
}

@keyframes slideInFromRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes slideOutToRight {
  from { transform: translateX(0); }
  to { transform: translateX(100%); }
}
```

## State Management Flow

```
User clicks ItemCard
       ↓
MenuScreen.handleItemClick()
       ↓
1. Capture scroll position
2. Filter categoryItems  
3. Find currentIndex
4. Set preview state
       ↓
PreviewScreen opens
       ↓
User swipes left/right
       ↓
PreviewScreen.handleSwipe()
       ↓
Navigate to next/previous item (circular)
       ↓
onItemChange(newIndex)
       ↓
MenuScreen updates preview state
       ↓
User clicks back button
       ↓
onClose()
       ↓
MenuScreen restores scroll position
```

## Performance Considerations

1. **Scroll Preservation**: Use `getState()` and `scrollTo()` from GroupedVirtuoso
2. **Image Loading**: Implement lazy loading for category items
3. **Smooth Animations**: Use CSS transforms for swipe gestures
4. **Memory Management**: Clean up event listeners on unmount
5. **Touch Performance**: Use `passive` touch event listeners where possible

## Testing Checklist

- [ ] Click on ItemCard opens PreviewScreen
- [ ] Back button returns to exact scroll position
- [ ] Swipe left navigates to next item in category
- [ ] Swipe right navigates to previous item in category
- [ ] Continuous navigation (last → first, first → last)
- [ ] Add to cart syncs with global state
- [ ] Ask AI opens chat with pre-filled message
- [ ] Category items section shows other items
- [ ] Clicking category items navigates within preview
- [ ] Responsive design on different screen sizes 