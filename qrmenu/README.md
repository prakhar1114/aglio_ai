# QR Menu

A mobile-first, Pinterest-style infinite scrolling menu web application, designed to serve multiple restaurants from a single code base.

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