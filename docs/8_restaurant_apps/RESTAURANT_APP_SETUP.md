# Restaurant App Setup Guide

This guide explains how to create new restaurant-specific applications using the shared QR Menu packages (`@qrmenu/ui`, `@qrmenu/core`, `@qrmenu/theme-loader`).

## Overview

Each restaurant gets their own independent app package that:
- Uses shared UI components and logic from the packages
- Defaults directly to `MenuScreen.jsx` (simplified, no complex routing)
- Has easy configuration via `vite.config.js`
- Can be quickly spun up and customized per restaurant

## Prerequisites

Before creating restaurant apps, ensure your workspace is properly configured:

1. **Update pnpm-workspace.yaml**: Make sure `qrmenu/pnpm-workspace.yaml` includes the restaurants directory:

```yaml
packages:
  - 'packages/*'
  - 'test-wrapper'
  - 'restaurants/*'  # ← This line is required!
```

2. **Refresh workspace**: Run `pnpm install` from the root qrmenu directory to refresh the workspace configuration.

Without this configuration, `pnpm install` won't work properly in restaurant apps and won't create `node_modules` folders.

## Quick Start

### Option 1: Automated Setup (Recommended)

Use the automation script to create everything automatically:

```bash
# From the qrmenu directory
cd qrmenu

# Ensure workspace is configured (see Prerequisites above)
node scripts/create-restaurant-app.js <restaurant-slug> "<Restaurant Display Name>"

# Example:
node scripts/create-restaurant-app.js handcrafted "Handcrafted Cafe"
```

This will create all the necessary files and folder structure automatically. Then:

```bash
cd restaurants/<restaurant-slug>
pnpm install  # Should now work if workspace is properly configured
pnpm dev
```

**Note**: If `pnpm install` doesn't create `node_modules`, check the Prerequisites section above.

### Option 2: Manual Setup

If you prefer to create everything manually:

#### 1. Create Restaurant App Directory

```bash
mkdir qrmenu/restaurants/{restaurant-name}
cd qrmenu/restaurants/{restaurant-name}
```

#### 2. Create Package Files

Create the following files in your restaurant directory:

#### `package.json`
```json
{
  "name": "qrmenu-{restaurant-name}",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@qrmenu/core": "workspace:*",
    "@qrmenu/theme-loader": "workspace:*",
    "@qrmenu/ui": "workspace:*",
    "@tanstack/react-query": "^5.40.17",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.30.1",
    "zustand": "^4.5.7"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.1.4",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

#### `vite.config.js`
```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    // ✅ Configure these variables for your restaurant
    'import.meta.env.VITE_API_BASE': JSON.stringify('http://192.168.1.10:8005'),
    'import.meta.env.VITE_WS_BASE': JSON.stringify('ws://192.168.1.10:8005'),
    'import.meta.env.VITE_RESTAURANT_SLUG': JSON.stringify('{restaurant-slug}'),
    'import.meta.env.VITE_RESTAURANT_NAME': JSON.stringify('{Restaurant Display Name}'),
    'import.meta.env.VITE_CLOUDFLARE_IMAGES_ACCOUNT_HASH': JSON.stringify('J-YAzqh0xCiR5OJtQewXmg'),
    'import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE': JSON.stringify('d8d0zszz3k5df3a6'),
  },
  build: {
    rollupOptions: {
      external: []
    }
  },
  resolve: {
    alias: {
      '@qrmenu/core': path.resolve('../../packages/core/src'),
      '@qrmenu/theme-loader': path.resolve('../../packages/theme-loader/src'),
      '@qrmenu/ui': path.resolve('../../packages/ui/src'),
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', '@tanstack/react-query'],
  },
});
```

#### `index.html`
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <title>{Restaurant Name} - QR Menu</title>
    <style>
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--font-heading, 'Inter', sans-serif);
            margin: 0;
            padding: 0;
            background: var(--background, #f8f9fa);
            color: var(--text, #333);
            width: 100%;
            overflow-x: hidden;
        }
        
        #app-root {
            width: 100%;
            max-width: 100%;
            overflow-x: hidden;
        }
    </style>
</head>
<body>
    <div id="app-root"></div>
    <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

#### `src/main.jsx` (Simplified - Direct to MenuScreen)
```javascript
import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Core imports
import { loadTheme } from '@qrmenu/theme-loader';
import { App } from '@qrmenu/core';
import { MenuScreen } from '@qrmenu/ui';

// Bootstrap the app
async function init() {
  const rootElem = document.getElementById('app-root');
  const root = createRoot(rootElem);

  try {
    const theme = await loadTheme();

    root.render(
      <App theme={theme}>
        <MenuScreen />
      </App>
    );
  } catch (error) {
    root.render(
      <div style={{ padding: 20 }}>
        Failed to load theme: {error.message}
      </div>
    );
    console.error('Theme loading failed:', error);
  }
}

init();
```

#### `src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Prevent unwanted zoom while allowing pinch-to-zoom */
html, body {
  touch-action: pan-x pan-y pinch-zoom;
  overflow-x: hidden;
  width: 100%;
  max-width: 100vw;
  -webkit-text-size-adjust: 100%;
}

/* Prevent iOS zoom on input focus */
input, textarea, select, button {
  font-size: 16px !important;
}

/* Prevent double-tap zoom while allowing pinch */
* {
  touch-action: manipulation;
}

/* Override for elements that need pinch zoom */
.zoomable, img, canvas {
  touch-action: pan-x pan-y pinch-zoom;
}
```

#### `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "../../packages/ui/src/**/*.{js,jsx,ts,tsx}",
    "../../packages/core/src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand)',
        'brand-light': 'var(--brand-light)',
        'brand-dark': 'var(--brand-dark)',
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
      },
    },
  },
  plugins: [],
}
```

#### `postcss.config.js`
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

#### 3. Create Default Theme

Create `public/theme.json`:
```json
{
  "brandColor": "#E23744",
  "fontHeading": "'Poppins', sans-serif",
  "secondaryColor": "#4ECDC4", 
  "backgroundColor": "#F7F9FC",
  "textColor": "#2C3E50",
  "logo": "/logo.png",
  "instagram": "@{restaurant-handle}",
  "extras": {
    "heroBanner": "welcome-promo"
  },
  "design": {
    "colors": {
      "primary": "#E23744",
      "primarySubtle": "#E2374415",
      "primaryLight": "#E2374430",
      "surface": "#FFFFFF",
      "surfaceElevated": "#FAFBFC",
      "surfacePressed": "#F5F6F7",
      "background": "#F7F9FC",
      "text": {
        "primary": "#1C1C1E",
        "secondary": "#6B7280",
        "tertiary": "#9CA3AF",
        "inverse": "#FFFFFF"
      },
      "border": {
        "light": "#E5E7EB",
        "medium": "#D1D5DB",
        "heavy": "#9CA3AF"
      },
      "semantic": {
        "success": "#10B981",
        "warning": "#F59E0B",
        "error": "#EF4444"
      }
    },
    "typography": {
      "fontFamily": "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      "sizes": {
        "xs": "12px",
        "sm": "14px",
        "base": "16px",
        "lg": "18px",
        "xl": "20px",
        "2xl": "24px"
      },
      "weights": {
        "regular": 400,
        "medium": 500,
        "semibold": 600,
        "bold": 700
      },
      "lineHeights": {
        "tight": 1.2,
        "normal": 1.4,
        "relaxed": 1.6
      }
    },
    "spacing": {
      "xs": "4px",
      "sm": "8px",
      "md": "12px",
      "lg": "16px",
      "xl": "20px",
      "2xl": "24px",
      "3xl": "32px",
      "4xl": "40px"
    },
    "radius": {
      "sm": "4px",
      "md": "8px",
      "lg": "12px",
      "xl": "16px",
      "full": "9999px"
    },
    "shadows": {
      "sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
      "md": "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
      "lg": "0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)",
      "xl": "0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)"
    }
  },
  "components": {
    "button": {
      "primary": {
        "background": "#E23744",
        "color": "#FFFFFF",
        "borderRadius": "6px",
        "fontSize": "12px",
        "fontWeight": "600",
        "padding": "6px",
        "size": "28px",
        "shadow": "0 2px 4px rgba(0, 0, 0, 0.15)"
      }
    },
    "card": {
      "background": "#FFFFFF",
      "borderRadius": "12px",
      "border": "1px solid #E5E7EB",
      "shadow": "0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)"
    },
    "dropdown": {
      "background": "#FFFFFF",
      "borderRadius": "8px",
      "border": "1px solid #E5E7EB",
      "shadow": "0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)",
      "itemHover": "#F7F9FC"
    },
    "categoryHeader": {
      "background": "rgba(255, 255, 255, 0.92)",
      "borderRadius": "6px",
      "border": "1px solid rgba(229, 231, 235, 0.6)",
      "shadow": "0 1px 3px rgba(0, 0, 0, 0.08)",
      "padding": "6px 10px",
      "fontSize": "14px",
      "fontWeight": "600"
    }
  }
}
```

#### 4. Install Dependencies & Run

```bash
# From the restaurant directory
pnpm install
pnpm dev
```

## Configuration

### Required Variables in `vite.config.js`

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE` | Backend API URL | `http://192.168.1.10:8005` |
| `VITE_WS_BASE` | WebSocket URL | `ws://192.168.1.10:8005` |
| `VITE_RESTAURANT_SLUG` | Unique restaurant identifier | `handcrafted` |
| `VITE_RESTAURANT_NAME` | Display name | `Handcrafted Cafe` |
| `VITE_CLOUDFLARE_*` | CDN configuration | See backend setup |

### Theme Customization

Modify `public/theme.json` to customize:
- Brand colors (`brandColor`, `secondaryColor`)
- Typography (`fontHeading`)
- Component styles
- Layout spacing and shadows

## Directory Structure

```
qrmenu/restaurants/{restaurant-name}/
├── package.json
├── vite.config.js
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── public/
│   └── theme.json
└── src/
    ├── main.jsx
    └── index.css
```

## Advanced Customization

If you need more than just `MenuScreen.jsx`, you can extend `src/main.jsx` to include routing:

```javascript
import { Routes, Route } from 'react-router-dom';
import { MenuScreen, PreviewScreen } from '@qrmenu/ui';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/*" element={<MenuScreen />} />
      <Route path="/preview/*" element={<PreviewScreen />} />
    </Routes>
  );
}

// Then use <AppRoutes /> instead of <MenuScreen />
```

## Troubleshooting

### `pnpm install` doesn't create `node_modules`

**Problem**: Running `pnpm install` in a restaurant app directory doesn't create a `node_modules` folder.

**Solution**: 
1. Check that `qrmenu/pnpm-workspace.yaml` includes `restaurants/*`
2. Run `pnpm install` from the root qrmenu directory
3. Try `pnpm install` in the restaurant directory again

### Workspace packages not found

**Problem**: Getting errors about `@qrmenu/ui`, `@qrmenu/core`, or `@qrmenu/theme-loader` not being found.

**Solution**: 
1. Ensure the workspace is properly configured (see Prerequisites)
2. Run `pnpm install` from the root directory
3. Check that the alias paths in `vite.config.js` are correct

### Build errors with Tailwind

**Problem**: Tailwind styles not working or build fails.

**Solution**: 
1. Ensure `tailwind.config.js` includes the correct content paths
2. Check that `postcss.config.js` is present
3. Verify `@tailwind` directives are in `src/index.css`

## Tips

1. **Development**: Use `pnpm dev` to start the development server
2. **Production**: Use `pnpm build` to create production build
3. **Theme Testing**: Modify `theme.json` and reload to see changes
4. **API Configuration**: Update API URLs in `vite.config.js` for different environments
5. **Multiple Restaurants**: Each gets its own folder under `qrmenu/restaurants/`
6. **Workspace Management**: Always run `pnpm install` from root after adding new restaurants

## Next Steps

1. Set up backend API with your restaurant data
2. Configure Cloudflare CDN for images/videos
3. Customize theme colors and branding
4. Add restaurant-specific assets (logo, etc.)
5. Deploy to production

---

This setup gives you a clean, minimal restaurant app that leverages all the shared components while being easy to configure and deploy independently.
