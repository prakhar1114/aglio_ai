# QR Menu Scripts

This directory contains automation scripts for the QR Menu project.

## create-restaurant-app.js

Automatically creates a new restaurant-specific app with all the necessary files and configuration.

### Usage

```bash
# From the qrmenu directory
node scripts/create-restaurant-app.js <restaurant-slug> [restaurant-display-name]
```

### Parameters

- `restaurant-slug`: Required. The unique identifier for the restaurant (used in URLs, file names, etc.)
- `restaurant-display-name`: Optional. The human-readable name for the restaurant. If not provided, it will capitalize the slug.

### Examples

```bash
# Basic usage (display name will be "Handcrafted")
node scripts/create-restaurant-app.js handcrafted

# With custom display name
node scripts/create-restaurant-app.js handcrafted "Handcrafted Cafe"

# Another example
node scripts/create-restaurant-app.js pizza-palace "Pizza Palace"
```

### What it creates

The script will create a complete restaurant app structure:

```
qrmenu/restaurants/{restaurant-slug}/
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

### After creation

1. Navigate to the restaurant directory:
   ```bash
   cd restaurants/{restaurant-slug}
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Update configuration in `vite.config.js` with your API URLs

4. Customize branding in `public/theme.json`

5. Start development server:
   ```bash
   pnpm dev
   ```

### Features

- **Simplified main.jsx**: Directly renders MenuScreen without complex routing
- **Pre-configured Vite**: All package aliases and build settings ready
- **Default theme**: Uses the standard QR Menu theme as a starting point
- **Tailwind setup**: Configured to work with the UI packages
- **Restaurant-specific variables**: Pre-populated with the restaurant slug and name

The created app will be ready to run immediately and will use all the shared components from `@qrmenu/ui`, `@qrmenu/core`, and `@qrmenu/theme-loader` packages. 