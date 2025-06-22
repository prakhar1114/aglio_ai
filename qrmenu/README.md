# QR Menu System

A modern QR code-based menu and ordering system for restaurants.

## Architecture

This project uses a monorepo structure with separate packages for core functionality, UI components, and theme loading.

### Packages

- `@qrmenu/core` - Core API logic, session management, and store
- `@qrmenu/ui` - React components for the menu interface
- `@qrmenu/theme-loader` - Theme management and styling

## Configuration

### Environment Variables

The frontend requires the following environment variables:

```bash
# API Configuration
VITE_API_BASE=http://localhost:8005
VITE_WS_BASE=ws://localhost:8005

# Restaurant Configuration (Required)
VITE_RESTAURANT_SLUG=your-restaurant-slug
```

For React apps (non-Vite):
```bash
REACT_APP_RESTAURANT_SLUG=your-restaurant-slug
```

### Restaurant Slug

The `RESTAURANT_SLUG` environment variable is required and should match the slug of the restaurant in your PostgreSQL database. This is used to fetch the correct menu and categories for each restaurant.

## API Endpoints

### Menu API
- `GET /restaurants/{restaurant_slug}/menu/` - Get menu items with filtering and pagination
- `GET /restaurants/{restaurant_slug}/categories/` - Get menu categories

### Filters
- `group_category` - Filter by group category
- `category_brief` - Filter by category brief  
- `is_veg` - Filter vegetarian items
- `price_cap` - Filter by maximum price

## Development

### Test Wrapper

The test wrapper is configured in `test-wrapper/vite.config.js` with default values:

```javascript
define: {
  'import.meta.env.VITE_API_BASE': JSON.stringify('http://192.168.1.103:8005'),
  'import.meta.env.VITE_WS_BASE': JSON.stringify('ws://192.168.1.103:8005'),
  'import.meta.env.VITE_RESTAURANT_SLUG': JSON.stringify('chiantis'),
}
```

Update these values to match your development environment and restaurant.

### Database Migration

The system has been migrated from Qdrant to PostgreSQL for better performance and simpler data management:

- Menu items are now stored in the `menu_items` table
- Categories are dynamically generated from menu item data
- Restaurant lookup is done by slug for multi-tenant support
- Promoted items are handled with proper SQL ordering

## Getting Started

1. Set up your environment variables (copy from examples above)
2. Ensure your PostgreSQL database has the restaurant with the correct slug
3. Start the development server
4. The menu and categories will be fetched based on your configured restaurant slug

## Monorepo Structure

The repository is organized as a pnpm workspace with the following layout:

```
qrmenu/
├── packages/
│   ├── theme-loader/   # Theme loading utility (load theme.json → CSS variables)
│   ├── core/           # App shell, routing, logic (React + TanStack Query)
│   └── ui/             # UI components (ItemCard, Feed, BottomBar, etc.)
└── test-wrapper/       # Minimal app for testing the theme-loader package

pnpm-workspace.yaml     # Monorepo configuration
QRMenu-design-guidelines.md  # Frontend design documentation
```

## Prerequisites

- Node.js >= 18
- pnpm >= 8

## Installation

Install dependencies for all workspace projects:

```bash
pnpm install
```

## Development

To start all development servers in parallel:

```bash
pnpm dev
```

To run only the test-wrapper demo (theme loader):

```bash
pnpm --filter qrmenu-test-wrapper dev
```

Future development commands for individual packages:

```bash
pnpm --filter @qrmenu/theme-loader dev
pnpm --filter @qrmenu/core dev
pnpm --filter @qrmenu/ui dev
```

## Building

To build all packages:

```bash
pnpm build
```

To build a specific package:

```bash
pnpm --filter @qrmenu/theme-loader build
```

## Testing

To run tests across all packages (using Vitest):

```bash
pnpm test
```

To run tests for a specific package:

```bash
pnpm --filter @qrmenu/theme-loader test
```

## Contributing

Pull requests, issues, and suggestions are welcome!

## License

MIT 