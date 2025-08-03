#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node create-restaurant-app.js <restaurant-name> [restaurant-display-name]');
  console.error('Example: node create-restaurant-app.js handcrafted "Handcrafted Cafe"');
  process.exit(1);
}

const restaurantSlug = args[0];
const restaurantName = args[1] || restaurantSlug.charAt(0).toUpperCase() + restaurantSlug.slice(1);
const restaurantDir = path.join(__dirname, '..', 'restaurants', restaurantSlug);

console.log(`Creating restaurant app: ${restaurantName} (${restaurantSlug})`);
console.log(`Directory: ${restaurantDir}`);

// Check workspace configuration
const workspaceFile = path.join(__dirname, '..', 'pnpm-workspace.yaml');
if (fs.existsSync(workspaceFile)) {
  const workspaceContent = fs.readFileSync(workspaceFile, 'utf8');
  if (!workspaceContent.includes('restaurants/*')) {
    console.warn('\n⚠️  WARNING: pnpm-workspace.yaml does not include "restaurants/*"');
    console.warn('   You may need to add this line to pnpm-workspace.yaml:');
    console.warn('   - \'restaurants/*\'');
    console.warn('   Then run "pnpm install" from the root directory.\n');
  }
} else {
  console.warn('\n⚠️  WARNING: pnpm-workspace.yaml not found. Workspace may not be configured properly.\n');
}

// Create directory structure
if (fs.existsSync(restaurantDir)) {
  console.error(`Error: Directory ${restaurantDir} already exists!`);
  process.exit(1);
}

fs.mkdirSync(restaurantDir, { recursive: true });
fs.mkdirSync(path.join(restaurantDir, 'src'));
fs.mkdirSync(path.join(restaurantDir, 'public'));

// File templates
const packageJson = {
  name: `qrmenu-${restaurantSlug}`,
  version: "1.0.0",
  private: true,
  type: "module",
  scripts: {
    dev: "vite",
    build: "vite build",
    preview: "vite preview"
  },
  dependencies: {
    "@qrmenu/core": "workspace:*",
    "@qrmenu/theme-loader": "workspace:*",
    "@qrmenu/ui": "workspace:*",
    "@tanstack/react-query": "^5.40.17",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.30.1",
    "zustand": "^4.5.7"
  },
  devDependencies: {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.1.4",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
};

const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    // ✅ Configure these variables for your restaurant
    'import.meta.env.VITE_API_BASE': JSON.stringify(process.env.VITE_API_BASE || 'http://localhost:8005'),
    'import.meta.env.VITE_WS_BASE': JSON.stringify(process.env.VITE_WS_BASE || 'ws://localhost:8005'),
    'import.meta.env.VITE_RESTAURANT_SLUG': JSON.stringify(process.env.VITE_RESTAURANT_SLUG || ${restaurantSlug} ),
    'import.meta.env.VITE_RESTAURANT_NAME': JSON.stringify(process.env.VITE_RESTAURANT_NAME || ${restaurantName}),
    'import.meta.env.VITE_CLOUDFLARE_IMAGES_ACCOUNT_HASH': JSON.stringify(process.env.VITE_CLOUDFLARE_IMAGES_ACCOUNT_HASH || 'J-YAzqh0xCiR5OJtQewXmg'),
    'import.meta.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE': JSON.stringify(process.env.VITE_CLOUDFLARE_STREAM_CUSTOMER_CODE || 'd8d0zszz3k5df3a6'),
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
`;

const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
    <title>${restaurantName} - QR Menu</title>
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
`;

const mainJsx = `import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Core imports
import { loadTheme } from '@qrmenu/theme-loader';
import { App } from '@qrmenu/core';
import { MenuScreen, ThemeProvider } from '@qrmenu/ui';

// Bootstrap the app
async function init() {
  const rootElem = document.getElementById('app-root');
  const root = createRoot(rootElem);

  try {
    const theme = await loadTheme();

    root.render(
      <App theme={theme}>
        <ThemeProvider theme={theme}>
          <MenuScreen />
        </ThemeProvider>
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
`;

const indexCss = `@tailwind base;
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
`;

const tailwindConfig = `/** @type {import('tailwindcss').Config} */
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
`;

const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`;

const themeJson = {
  brandColor: "#C72C48",
  fontHeading: "'Poppins', sans-serif",
  secondaryColor: "#4ECDC4",
  backgroundColor: "#F7F9FC",
  textColor: "#2C3E50",
  logo: "/logo.png",
  instagram: `@${restaurantSlug}`,
  restaurantName: restaurantName,
  restaurantLogo: "/logo.png",
  extras: {
    heroBanner: "welcome-promo"
  },
  navigationOverlay: {
    title: `${restaurantName} Menu`,
    specialsTitle: "Today's Specials",
    browseMenuTitle: "Browse Menu",
    brandColor: "#C72C48",
    showLogo: true,
    logoPosition: "top",
    coverImage: "https://imagedelivery.net/[ACCOUNT_HASH]/[IMAGE_ID]/large",
    rotate: 0
  },
  design: {
    colors: {
      primary: "#C72C48",
      primarySubtle: "#C72C4815",
      primaryLight: "#C72C4830",
      surface: "#FFFFFF",
      surfaceElevated: "#FAFBFC",
      surfacePressed: "#F5F6F7",
      background: "#F7F9FC",
      text: {
        primary: "#1C1C1E",
        secondary: "#6B7280",
        tertiary: "#9CA3AF",
        inverse: "#FFFFFF"
      },
      border: {
        light: "#E5E7EB",
        medium: "#D1D5DB",
        heavy: "#9CA3AF"
      },
      semantic: {
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444"
      }
    },
    typography: {
      fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      sizes: {
        xs: "12px",
        sm: "14px",
        base: "16px",
        lg: "18px",
        xl: "20px",
        "2xl": "24px"
      },
      weights: {
        regular: 400,
        medium: 500,
        semibold: 600,
        bold: 700
      },
      lineHeights: {
        tight: 1.2,
        normal: 1.4,
        relaxed: 1.6
      }
    },
    spacing: {
      xs: "4px",
      sm: "8px",
      md: "12px",
      lg: "16px",
      xl: "20px",
      "2xl": "24px",
      "3xl": "32px",
      "4xl": "40px"
    },
    radius: {
      sm: "4px",
      md: "8px",
      lg: "12px",
      xl: "16px",
      full: "9999px"
    },
    shadows: {
      sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
      md: "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
      lg: "0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)",
      xl: "0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)"
    }
  },
  components: {
    button: {
      primary: {
        background: "#C72C48",
        color: "#FFFFFF",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: "600",
        padding: "6px",
        size: "28px",
        shadow: "0 2px 4px rgba(0, 0, 0, 0.15)"
      }
    },
    card: {
      background: "#FFFFFF",
      borderRadius: "12px",
      border: "1px solid #E5E7EB",
      shadow: "0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)"
    },
    dropdown: {
      background: "#FFFFFF",
      borderRadius: "8px",
      border: "1px solid #E5E7EB",
      shadow: "0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.06)",
      itemHover: "#F7F9FC"
    },
    categoryHeader: {
      background: "rgba(255, 255, 255, 0.92)",
      borderRadius: "6px",
      border: "1px solid rgba(229, 231, 235, 0.6)",
      shadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
      padding: "6px 10px",
      fontSize: "14px",
      fontWeight: "600"
    }
  }
};

const vercelConfig = {
    "buildCommand": "pnpm build",
    "outputDirectory": "dist",
    "installCommand": "pnpm install",
    "framework": "vite",
    "git": {
      "deploymentEnabled": false
    },
    "rewrites": [
      {
        "source": "/(.*)",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "/assets/(.*)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "/(.*).js",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "/(.*).css",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "/index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=0, must-revalidate"
          }
        ]
      }
    ]
} 



// Write all files
try {
  // Root files
  fs.writeFileSync(path.join(restaurantDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  fs.writeFileSync(path.join(restaurantDir, 'vite.config.js'), viteConfig);
  fs.writeFileSync(path.join(restaurantDir, 'index.html'), indexHtml);
  fs.writeFileSync(path.join(restaurantDir, 'tailwind.config.js'), tailwindConfig);
  fs.writeFileSync(path.join(restaurantDir, 'postcss.config.js'), postcssConfig);
  fs.writeFileSync(path.join(restaurantDir, 'vercel.json'), JSON.stringify(vercelConfig, null, 2));
  
  // Src files
  fs.writeFileSync(path.join(restaurantDir, 'src', 'main.jsx'), mainJsx);
  fs.writeFileSync(path.join(restaurantDir, 'src', 'index.css'), indexCss);
  
  // Public files
  fs.writeFileSync(path.join(restaurantDir, 'public', 'theme.json'), JSON.stringify(themeJson, null, 2));

  console.log('\n✅ Restaurant app created successfully!');
  console.log('\nNext steps:');
  console.log(`1. Ensure workspace is configured (see warning above if any)`);
  console.log(`2. cd qrmenu/restaurants/${restaurantSlug}`);
  console.log('3. pnpm install');
  console.log('4. Update vite.config.js with your API URLs');
  console.log('5. Customize public/theme.json with your branding');
  console.log('6. pnpm dev');
  console.log('\nDirectory structure created:');
  console.log(`qrmenu/restaurants/${restaurantSlug}/`);
  console.log('├── package.json');
  console.log('├── vite.config.js');
  console.log('├── index.html');
  console.log('├── tailwind.config.js');
  console.log('├── postcss.config.js');
  console.log('├── public/');
  console.log('│   └── theme.json');
  console.log('└── src/');
  console.log('    ├── main.jsx');
  console.log('    └── index.css');

} catch (error) {
  console.error('Error creating restaurant app:', error);
  // Clean up by deleting the partially created directory
  fs.rmSync(restaurantDir, { recursive: true, force: true });
  process.exit(1);
} 