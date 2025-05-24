# Aglio Restaurant Mobile Web App

A modern, mobile-first web application for displaying restaurant menu items in a Pinterest-like masonry grid layout with preview modal functionality.

## Features

### 🎨 Visual Design
- **Pinterest-like Layout**: Responsive masonry grid that adapts to different screen sizes
- **Mobile-First**: Optimized for mobile devices with touch-friendly interactions
- **Modern UI**: Clean design with smooth animations and transitions
- **Gradient Header**: Beautiful gradient header with fixed positioning

### 📱 Core Functionality

#### Page 1: Menu Feed
- **Masonry Grid**: Pinterest-style layout with varying image heights
- **Responsive Columns**: 2 columns on mobile, up to 5 columns on desktop
- **Quick Actions**: Hover overlay with like and add-to-cart buttons
- **Lazy Loading**: Images load efficiently as you scroll
- **Loading Indicator**: Visual feedback during content loading

#### Page 2: Preview Modal
- **Full Preview**: Click any menu item to open detailed view
- **Dish Information**: Name, description, and price prominently displayed
- **Action Buttons**: 
  - ❤️ **Heart/Like**: Toggle favorite status with animation
  - 🛒 **Add to Cart**: Add items with quantity selection
  - 📤 **Share**: Native share API or clipboard fallback
- **Quantity Controls**: Increase/decrease quantity (1-10 items)
- **Modal Interactions**: Click outside or ESC key to close

### 🛒 Cart System
- **Cart Counter**: Badge showing total items in cart
- **Persistent State**: Cart maintains state during session
- **Toast Notifications**: Feedback for all user actions

### 📱 Mobile Optimizations
- **Touch Gestures**: Optimized for touch interactions
- **Responsive Design**: Breakpoints for all device sizes
- **Fast Loading**: Optimized images and efficient rendering
- **Smooth Scrolling**: Enhanced scrolling experience

## File Structure

```
app-v3/
├── index.html          # Main HTML file with semantic structure
├── css/
│   └── styles.css      # Complete CSS with mobile-first approach
├── js/
│   └── app.js          # JavaScript functionality and interactions
├── images/             # Placeholder for custom images
└── README.md           # This documentation file
```

## Technical Implementation

### HTML Structure
- Semantic HTML5 elements
- Accessible markup with ARIA labels
- Meta viewport for mobile optimization
- Font Awesome icons for UI elements

### CSS Features
- **CSS Grid & Flexbox**: Modern layout techniques
- **CSS Custom Properties**: For maintainable theming
- **Animations**: Smooth transitions and micro-interactions
- **Responsive Design**: Mobile-first media queries
- **Custom Scrollbar**: Styled scrollbar for webkit browsers

### JavaScript Functionality
- **ES6+ Features**: Modern JavaScript syntax
- **Event Delegation**: Efficient event handling
- **Local State Management**: Cart and favorites tracking
- **Toast Notifications**: Custom notification system
- **Modal Management**: Proper focus and scroll management

## Sample Menu Data

The app includes 12 sample menu items with:
- High-quality food images from Unsplash
- Realistic pricing and descriptions
- Various categories (burgers, seafood, pizza, etc.)
- Rating and cook time information

## Browser Compatibility

- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Mobile Browsers**: iOS Safari, Chrome Mobile
- **Features**: Uses modern CSS and JavaScript features
- **Fallbacks**: Graceful degradation for older browsers

## Usage Instructions

1. **Open the Application**: Open `index.html` in a web browser
2. **Browse Menu**: Scroll through the Pinterest-like feed
3. **Quick Actions**: Hover over items (desktop) or tap quick action buttons
4. **View Details**: Click any menu item to open the preview modal
5. **Add to Cart**: Use quantity controls and add items to cart
6. **Like Items**: Heart button to add/remove from favorites
7. **Share Items**: Use share button for native sharing

## Customization

### Adding Your Own Images
Replace the Unsplash URLs in `js/app.js` with your own food images:

```javascript
// In the menuItems array
image: "path/to/your/image.jpg"
```

### Styling Customization
Key CSS variables can be modified in `css/styles.css`:

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --accent-color: #ff6b6b;
}
```

### Adding Menu Items
Add new items to the `menuItems` array in `js/app.js`:

```javascript
{
    id: 13,
    name: "Your Dish Name",
    price: 15.99,
    description: "Detailed description...",
    image: "path/to/image.jpg",
    category: "category",
    rating: 4.5,
    cookTime: "15 min"
}
```

## Performance Features

- **Lazy Loading**: Images load only when needed
- **Efficient Rendering**: Minimal DOM manipulation
- **Optimized Images**: Responsive image loading
- **Smooth Animations**: Hardware-accelerated transitions
- **Memory Management**: Proper event cleanup

## Future Enhancements

- Search and filter functionality
- Category-based filtering
- User authentication
- Order management system
- Real-time inventory updates
- Push notifications
- Offline support with service workers

## Development Notes

This is a front-end only application perfect for:
- **Prototyping**: Quick restaurant menu demos
- **Learning**: Modern web development techniques
- **Portfolio**: Showcasing responsive design skills
- **Integration**: Can be easily integrated with backend APIs

---

**Note**: This application uses placeholder images from Unsplash. In a production environment, replace these with your actual food photography. 