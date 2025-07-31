# NavigationOverlay Theme Configuration Guide

## Overview

The NavigationOverlay component is fully customizable through the `theme.json` file. This guide provides detailed information about all available configuration options and their effects on the overlay's appearance and behavior.

## Theme Structure

### Complete Example

```json
{
  "restaurantName": "Amado",
  "restaurantLogo": "/amado-color-logo.png",
  "logo": "/logo.png",
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

## Root Level Properties

### `restaurantName`
- **Type**: `string`
- **Default**: `"Restaurant"`
- **Description**: The restaurant name displayed prominently below the logo
- **Example**: `"Amado"`

### `restaurantLogo`
- **Type**: `string`
- **Default**: `null`
- **Description**: Primary logo path (preferred over `logo`)
- **Example**: `"/amado-color-logo.png"`
- **Notes**: Should be placed in the restaurant's `public/` directory

### `logo`
- **Type**: `string`
- **Default**: `null`
- **Description**: Fallback logo path if `restaurantLogo` is not available
- **Example**: `"/logo.png"`

### `brandColor`
- **Type**: `string`
- **Default**: `"#C72C48"`
- **Description**: Primary brand color used throughout the overlay
- **Example**: `"#C72C48"` (Amado's red)
- **Usage**: Used for restaurant name, button borders, and accent colors

## NavigationOverlay Properties

### `title`
- **Type**: `string`
- **Default**: `"Navigation Menu"`
- **Description**: Main overlay title (currently not displayed in modern design)
- **Example**: `"Amado Menu"`

### `specialsTitle`
- **Type**: `string`
- **Default**: `"Today's Specials"`
- **Description**: Text displayed on the specials button
- **Example**: `"Today's Specials"`, `"Chef's Recommendations"`, `"Daily Specials"`

### `browseMenuTitle`
- **Type**: `string`
- **Default**: `"Browse Menu"`
- **Description**: Section heading above category buttons
- **Example**: `"Browse Menu"`, `"Explore Categories"`, `"Menu Sections"`

### `brandColor` (NavigationOverlay specific)
- **Type**: `string`
- **Default**: `"#C72C48"`
- **Description**: Brand color specifically for the navigation overlay
- **Example**: `"#C72C48"`
- **Usage**: Overrides root `brandColor` for this component

### `showLogo`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Whether to display the restaurant logo
- **Example**: `true`, `false`
- **Effect**: When `false`, logo section is hidden and spacing adjusts

### `logoPosition`
- **Type**: `string`
- **Default**: `"top"`
- **Description**: Logo position (currently only "top" is supported)
- **Example**: `"top"`
- **Notes**: Future versions may support "center", "bottom", etc.

### `specialsBackgroundImage`
- **Type**: `string`
- **Default**: `null`
- **Description**: Background image for the specials button
- **Example**: `"/amado-specials-bg.jpg"`
- **Effect**: When provided, shows as background with gradient overlay
- **Notes**: Should be placed in the restaurant's `public/` directory

### `coverImage`
- **Type**: `string`
- **Default**: `null`
- **Description**: Cover image for the entire overlay (LinkedIn/Zomato style)
- **Example**: `"https://imagedelivery.net/[ACCOUNT_HASH]/[IMAGE_ID]/large"`
- **Effect**: When provided, displays as full-screen background at the top
- **Notes**: Uses Cloudflare Images for optimized delivery. Replace `[ACCOUNT_HASH]` and `[IMAGE_ID]` with your Cloudflare account hash and image ID. Available variants: `public`, `thumbnail`, `small`, `medium`, `large`.

### `rotate`
- **Type**: `number`
- **Default**: `0`
- **Description**: Rotation angle for the cover image in degrees
- **Example**: `90` (rotates image 90 degrees clockwise)
- **Effect**: Applies CSS transform rotation to the cover image
- **Notes**: Common values: `0`, `90`, `180`, `270`. Use for correcting image orientation.

## Asset Requirements

### Logo Specifications
- **Format**: PNG, JPG, SVG
- **Recommended Size**: 200x200px minimum
- **Aspect Ratio**: Square or close to square
- **Background**: Transparent or white background preferred
- **Placement**: `restaurants/[restaurant]/public/`

### Specials Background Image
- **Format**: JPG, PNG
- **Recommended Size**: 400x200px
- **Aspect Ratio**: 2:1 or wider
- **Quality**: High resolution for crisp display
- **Placement**: `restaurants/[restaurant]/public/`

### Cover Image
- **Format**: JPG, PNG
- **Recommended Size**: 1200x400px minimum
- **Aspect Ratio**: 3:1 or wider (landscape)
- **Quality**: High resolution for full-screen display
- **Content**: Restaurant ambiance, food, or branded imagery
- **Placement**: Upload to Cloudflare Images and use the provided URL

## Color Schemes

### Default Color Palette
```json
{
  "brandColor": "#C72C48",
  "textPrimary": "#1A1A1A",
  "textSecondary": "#374151",
  "textTertiary": "#6B7280",
  "specialsGradient": ["#FF6B35", "#F7931E"],
  "background": "rgba(0,0,0,0.8)",
  "cardBackground": "rgba(255,255,255,0.95)"
}
```

### Popular Restaurant Color Schemes

#### Italian Restaurant (Amado)
```json
{
  "brandColor": "#C72C48",
  "navigationOverlay": {
    "brandColor": "#C72C48"
  }
}
```

#### Asian Restaurant
```json
{
  "brandColor": "#E53E3E",
  "navigationOverlay": {
    "brandColor": "#E53E3E"
  }
}
```

#### Cafe
```json
{
  "brandColor": "#8B4513",
  "navigationOverlay": {
    "brandColor": "#8B4513"
  }
}
```

## Implementation Examples

### Minimal Configuration
```json
{
  "restaurantName": "My Restaurant",
  "brandColor": "#FF6B35"
}
```

### Full Configuration
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

### No Logo Configuration
```json
{
  "restaurantName": "Simple Restaurant",
  "brandColor": "#3B82F6",
  "navigationOverlay": {
    "showLogo": false,
    "specialsTitle": "Chef's Picks",
    "browseMenuTitle": "Menu Categories"
  }
}
```

## Fallback Behavior

### Missing Properties
- If `restaurantName` is missing: Uses "Restaurant"
- If `restaurantLogo` is missing: Falls back to `logo`
- If both logos are missing: Logo section is hidden
- If `brandColor` is missing: Uses default `#C72C48`
- If `specialsBackgroundImage` is missing: Uses gradient background

### Error Handling
- Logo loading errors: Logo section is hidden gracefully
- Invalid color values: Falls back to default colors
- Missing theme.json: Uses all default values
- Invalid image paths: Background images are ignored

## Best Practices

### Logo Design
1. **Use transparent backgrounds** for better integration
2. **Keep logos simple** - they display at 72x72px
3. **Test on different backgrounds** - overlay has glass effect
4. **Provide high-resolution versions** for crisp display

### Color Selection
1. **Choose brand-appropriate colors** that match your restaurant theme
2. **Ensure good contrast** with white text
3. **Test accessibility** - colors should meet WCAG guidelines
4. **Consider cultural associations** of colors

### Content Strategy
1. **Keep specials title short** - button has limited width
2. **Use clear, descriptive category names** - they appear as "Category Menu"
3. **Make browse menu title engaging** - it's the main call-to-action
4. **Consider seasonal variations** for specials content

### Performance
1. **Optimize images** - use WebP format when possible
2. **Keep logo files under 100KB** for fast loading
3. **Use appropriate image dimensions** - don't use oversized images
4. **Test on mobile devices** - overlay is primarily mobile-focused

## Troubleshooting

### Common Issues

#### Logo Not Displaying
- Check file path in `restaurantLogo` or `logo`
- Ensure file exists in `public/` directory
- Verify file format (PNG, JPG, SVG)
- Check browser console for 404 errors

#### Colors Not Applying
- Verify color format is valid hex code
- Check for typos in property names
- Ensure theme.json is valid JSON
- Clear browser cache if testing changes

#### Specials Button Not Showing
- Verify "Recommendations" category exists in menu data
- Check `hasRecommendations` logic in component
- Ensure menu items have proper `group_category` mapping

#### Overlay Not Appearing
- Confirm `enableNavigationOverlay={true}` is set
- Check that menu data is loading properly
- Verify theme context is working
- Check browser console for errors

### Debug Mode
Add this to your theme.json for debugging:
```json
{
  "debug": true,
  "navigationOverlay": {
    "debug": true
  }
}
```

## Version History

### v1.0 (Current)
- Modern glass-morphism design
- Theme-based customization
- Instagram/Zomato-inspired styling
- Full-screen overlay
- Smooth animations

### Future Enhancements
- Custom logo positioning
- Multiple specials sections
- Animated backgrounds
- Custom button styles
- Advanced theming options 