# Aggregated Category Feature

## Overview

The MasonryFeed component now supports a hierarchical category system that groups menu items by both `group_category` (top-level) and `category_brief` (sub-level). This feature is enabled by setting the `showAggregatedCategory` prop to `true`.

## How It Works

When `showAggregatedCategory={true}`, the component displays:

1. **Group Category Button**: Shows the current visible group category (e.g., "Main Course", "Drinks")
2. **Separator**: A "/" character between the two buttons
3. **Sub Category Button**: Shows the current visible sub-category (e.g., "Pizza", "Pasta")

## Usage

```jsx
import { MasonryFeed } from '@qrmenu/ui';

// Enable aggregated category view
<MasonryFeed 
  showAggregatedCategory={true}
  filters={filters}
  onItemClick={handleItemClick}
/>

// Standard view (default)
<MasonryFeed 
  showAggregatedCategory={false} // or omit this prop
  filters={filters}
  onItemClick={handleItemClick}
/>
```

## Data Structure Requirements

For the aggregated category feature to work, your menu items should have:

- `group_category`: Top-level category (e.g., "Main Course", "Drinks", "Appetizers")
- `category_brief`: Sub-category (e.g., "Pizza", "Pasta", "Mocktail")

Example item structure:
```javascript
{
  id: "1",
  name: "Margherita Pizza",
  group_category: "Main Course",
  category_brief: "Pizza",
  // ... other properties
}
```

## Features

### Hierarchical Navigation
- Click the group category button to open a dropdown with all available group categories
- Click the sub-category button to open a dropdown with all available sub-categories
- Selecting a group category navigates to the first sub-category in that group

### Visual Design
- Both buttons maintain the same styling as the original single category button
- Smooth animations and hover effects
- Consistent with the existing design system
- Responsive layout that works on mobile and desktop

### State Management
- Tracks current visible group category and sub-category
- Updates automatically as user scrolls through the feed
- Maintains separate dropdown states for group and sub-categories

## Implementation Details

### New Components
- `GroupCategoryDropdown`: Handles the group category dropdown
- Updated `CategoryDropdownButton`: Supports both single and hierarchical display modes

### New State Variables
- `currentVisibleGroupCategory`: Tracks the currently visible group category
- `isGroupDropdownOpen`: Controls the group category dropdown visibility

### Data Processing
- `groupCategoryMap`: Maps `category_brief` → `group_category`
- `groupCategories`: Array of unique group categories
- `groupCategoryIndexMap`: Maps `group_category` → first `category_brief` index

## Example Output

When enabled, the UI shows:
```
[Main Course ▼] / [Pizza ▼]
```

When disabled (default), the UI shows:
```
[Pizza ▼]
```

## Browser Compatibility

This feature works on all modern browsers that support:
- CSS Grid and Flexbox
- ES6+ JavaScript features
- React 16.8+ (for hooks)

## Performance Considerations

- The feature adds minimal overhead to the existing component
- Data processing is optimized with `useMemo` to prevent unnecessary recalculations
- Virtualization performance is maintained
- No impact on scrolling performance 