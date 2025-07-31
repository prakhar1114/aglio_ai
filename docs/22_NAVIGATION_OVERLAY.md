# Navigation Overlay Feature

## Overview

The Navigation Overlay is a premium, modern navigation component that provides quick access to different menu categories. It appears as a full-screen overlay with a sophisticated design inspired by Instagram and Zomato when the `enableNavigationOverlay` prop is set to `true` in the MasonryFeed component.

## Features

- **Full-screen overlay** with modern glass-morphism design
- **Auto-dismiss** after selection
- **Premium animations** with smooth scale-in and backdrop blur effects
- **Today's Specials** button with gradient styling
- **Group category navigation** with modern button design
- **Smooth scrolling** to selected categories
- **Responsive design** for mobile and desktop
- **Theme-based customization** through theme.json

## Usage

### Enable Navigation Overlay

```jsx
import { MenuScreen } from '@qrmenu/ui';

<MenuScreen 
  enableNavigationOverlay={true}
  // ... other props
/>
```

### In Restaurant Configuration

```jsx
// In restaurant's main.jsx
<MenuScreen 
  enableCallWaiter={false}
  showToWaiter={true}
  enablePlaceOrder={false}
  showAskNameModal={false}
  enableNavigationOverlay={true}  // Enable the navigation overlay
/>
```

## Theme Configuration

The NavigationOverlay is fully customizable through the `theme.json` file. Here's the complete structure:

### Basic Theme Structure

```json
{
  "restaurantName": "Amado",
  "restaurantLogo": "/amado-logo.png",
  "logo": "/logo.png",
  "brandColor": "#C72C48",
  "navigationOverlay": {
    "title": "Amado Menu",
    "specialsTitle": "Today's Specials",
    "browseMenuTitle": "Browse Menu",
    "brandColor": "#C72C48",
    "showLogo": true,
    "logoPosition": "top",
    "specialsBackgroundImage": "/specials-bg.jpg"
  }
}
```

### Theme Properties

#### Root Level Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `restaurantName` | string | "Restaurant" | Restaurant name displayed below logo |
| `restaurantLogo` | string | null | Primary logo path (preferred over `logo`) |
| `logo` | string | null | Fallback logo path |
| `brandColor` | string | "#C72C48" | Primary brand color used throughout |

#### NavigationOverlay Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `title` | string | "Navigation Menu" | Main overlay title |
| `specialsTitle` | string | "Today's Specials" | Text for specials button |
| `browseMenuTitle` | string | "Browse Menu" | Section heading for categories |
| `brandColor` | string | "#C72C48" | Brand color for buttons and accents |
| `showLogo` | boolean | true | Whether to display the logo |
| `logoPosition` | string | "top" | Logo position ("top" or "none") |
| `specialsBackgroundImage` | string | null | Background image for specials button |

### Example Theme Configuration

```json
{
  "restaurantName": "Amado",
  "restaurantLogo": "/amado-color-logo.png",
  "brandColor": "#C72C48",
  "navigationOverlay": {
    "title": "Amado Menu",
    "specialsTitle": "Today's Specials",
    "browseMenuTitle": "Browse Menu",
    "brandColor": "#C72C48",
    "showLogo": true,
    "logoPosition": "top",
    "specialsBackgroundImage": "/amado-specials-bg.jpg"
  }
}
```

### Asset Placement

Place your assets in the restaurant's `public/` directory:

```
restaurants/amado/
├── public/
│   ├── theme.json
│   ├── amado-logo.png          # Restaurant logo
│   ├── amado-color-logo.png    # Alternative logo
│   ├── specials-bg.jpg         # Background for specials
│   └── assets/
│       └── branding/
│           ├── logo.png
│           └── specials-bg.jpg
```

## Behavior

1. **Loading**: Overlay appears when data loads and `enableNavigationOverlay` is `true`
2. **Auto-dismiss**: Closes automatically when a category is selected
3. **Manual close**: Users can click the backdrop to dismiss
4. **Navigation**: Clicking a category smoothly scrolls to that section

## Design

### Modern Visual Elements

- **Backdrop**: Dark gradient with 30px blur effect
- **Container**: Glass-morphism card with 28px border radius
- **Logo**: Circular container with subtle shadow and border
- **Typography**: Inter font family for modern look
- **Buttons**: 
  - Specials: Orange gradient with sparkle icon
  - Categories: Glass-morphism with subtle hover effects
- **Animations**: Smooth cubic-bezier transitions

### Color Scheme

- **Primary**: Brand color from theme
- **Background**: Dark gradient overlay
- **Text**: Neutral grays (#1A1A1A, #374151, #6B7280)
- **Specials**: Orange gradient (#FF6B35 to #F7931E)
- **Borders**: Subtle grays with low opacity

### Animations

- **Entrance**: Scale-in with translateY (0.4s cubic-bezier)
- **Backdrop**: Blur animation (0px → 30px)
- **Buttons**: Hover with scale and lift effects
- **Transitions**: Smooth 0.2s cubic-bezier for all interactions

## Data Requirements

The overlay requires menu items with:

- `group_category`: Top-level category (e.g., "Main Course", "Drinks")
- `category_brief`: Sub-category (e.g., "Pizza", "Pasta")

### Example Item Structure

```javascript
{
  id: "1",
  name: "Margherita Pizza",
  group_category: "Main Course",
  category_brief: "Pizza",
  // ... other properties
}
```

## Technical Details

### Z-Index Hierarchy

- Navigation Overlay: `z-index: 10000`
- Category Dropdown: `z-index: 9998`
- Filter Dropdown: `z-index: 9998`
- Category Button: `z-index: 9999`

### Performance

- Loads independently of feed data
- Minimal impact on masonry rendering
- Efficient category mapping with `useMemo`
- Auto-dismiss prevents UI clutter

### Accessibility

- Keyboard navigation support
- Screen reader friendly
- Focus management
- High contrast design

## Configuration Options

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `enableNavigationOverlay` | boolean | `false` | Enable/disable the navigation overlay |

## Example Restaurant Configuration

```jsx
// restaurants/amado/src/main.jsx
<MenuScreen 
  enableCallWaiter={false}
  showToWaiter={true}
  message="Please go to the counter to make the payment and confirm."
  enablePlaceOrder={false}
  showAskNameModal={false}
  enableNavigationOverlay={true}  // Navigation overlay enabled
/>
```

## Browser Compatibility

- Modern browsers with CSS backdrop-filter support
- Graceful fallback for older browsers
- Mobile-optimized touch interactions
- Responsive design for all screen sizes

## Design Inspiration

The NavigationOverlay design is inspired by:

- **Instagram**: Clean typography, subtle shadows, glass effects
- **Zomato**: Orange accent colors, modern button styling
- **Modern Apps**: Inter font, refined spacing, premium feel
- **Glass-morphism**: Backdrop blur, transparency effects 