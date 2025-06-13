import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Routes, Route, useNavigate } from 'react-router-dom';

// Core / shared imports
import { loadTheme } from '@qrmenu/theme-loader';
import { App } from '@qrmenu/core';
import { useMenu } from '@qrmenu/core';
import { MenuScreen, FeedItemSwitcher } from '@qrmenu/ui';
import { MasonryInfiniteGrid } from '@egjs/react-infinitegrid';

/*******************************
 *  Mock data & helpers
 ******************************/
const mockItems = [
  { id: 'burger', kind: 'food', name: 'Burger', price: 199, image_url: 'https://picsum.photos/300?1' },
  { id: 'promo42', kind: 'promotion', image_url: 'https://picsum.photos/600/300?2', fullBleed: true },
  { id: 'pizza', kind: 'food', name: 'Veg Pizza', price: 299, image_url: 'https://picsum.photos/300?3' },
  { id: 'story21', kind: 'video', url: 'https://www.w3schools.com/html/mov_bbb.mp4', poster: 'https://picsum.photos/800/450?4', fullBleed: true },
];

/*******************************
 *  Raw API Masonry Feed
 ******************************/
function RawMenuFeed() {
  const { data, fetchNextPage, hasNextPage, isLoading, error } = useMenu();
  const gridRef = useRef(null);

  const fetchedItems = data ? data.pages.flatMap((p) => p.items) : [];
  const transformedItems = fetchedItems
    .filter((item) => item && item.id)
    .map((item) => ({ ...item, kind: 'food' }));

  const items = transformedItems.length > 0 ? transformedItems : mockItems;

  const getItemWidth = () => {
    if (typeof window !== 'undefined') {
      const containerWidth = window.innerWidth;
      return Math.floor((containerWidth - 16) / 2);
    }
    return 'calc(50% - 8px)';
  };

  if (isLoading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading menu...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Error loading menu: {error.message}</p>
        <p>Using mock data instead.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '100%',
        padding: '0px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
      }}
    >
      <div style={{ padding: '8px' }}>
        <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
          API Items: {fetchedItems.length} | Total Items: {items.length}
        </p>
      </div>

      <MasonryInfiniteGrid
        ref={gridRef}
        className="masonry-feed"
        gap={4}
        align="center"
        column={2}
        columnSize={getItemWidth()}
        style={{ width: '100%', maxWidth: '100%' }}
        onRequestAppend={() => {
          if (hasNextPage) fetchNextPage();
        }}
      >
        {items
          .filter((item) => item && item.id)
          .map((item) => (
            <div
              key={item.id}
              className="feed-item"
              data-grid-groupkey={item.id}
              style={{
                width: getItemWidth(),
                boxSizing: 'border-box',
                borderRadius: '8px',
                overflow: 'hidden',
              }}
            >
              <FeedItemSwitcher item={item} />
            </div>
          ))}
      </MasonryInfiniteGrid>
    </div>
  );
}

/*******************************
 *  Pages
 ******************************/
function ThemeLoaderTestPage({ theme }) {
  return (
    <div className="container">
      <h1>QR Menu Theme Loader Test</h1>

      <div className="test-card">
        <h2>Theme Status</h2>
        <div className="status success">Theme loaded successfully!</div>
      </div>

      <div className="test-card">
        <h2>Visual Test</h2>
        <p>This card should use the brand color from theme.json</p>
        <div className="brand-color" />
        <p>
          Font: <span style={{ fontFamily: 'var(--font-heading)' }}>This text uses the theme font</span>
        </p>
      </div>

      <div className="test-card">
        <h2>Theme Variables</h2>
        <pre style={{ background: '#f5f5f5', padding: 10, borderRadius: 4, overflow: 'auto' }}>
          {JSON.stringify(theme, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function MasonryGridPage() {
  return (
    <div>
      <RawMenuFeed />
    </div>
  );
}

/*******************************
 *  Home Page with navigation buttons
 ******************************/
function HomePage() {
  const navigate = useNavigate();

  const btnStyle = {
    padding: '14px 24px',
    fontSize: '16px',
    backgroundColor: 'var(--brand, #D9232E)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    minWidth: '220px',
    fontWeight: 600,
    margin: '8px 0',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        gap: 12,
        background: '#f8f9fa',
      }}
    >
      <h1 style={{ color: 'var(--brand, #D9232E)', marginBottom: 32 }}>QR-Menu Test Suite</h1>
      <button style={btnStyle} onClick={() => navigate('/theme')}>🎨 Theme Loader Test</button>
      <button style={btnStyle} onClick={() => navigate('/grid')}>🗂️ Masonry Grid</button>
      <button style={btnStyle} onClick={() => navigate('/menu')}>🍽️ Menu Screen</button>
    </div>
  );
}

/*******************************
 *  App Router
 ******************************/
function AppRoutes({ theme }) {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/theme" element={<ThemeLoaderTestPage theme={theme} />} />
      <Route path="/grid" element={<MasonryGridPage />} />
      <Route path="/menu/*" element={<MenuScreen />} />
    </Routes>
  );
}

/*******************************
 *  Bootstrap
 ******************************/
async function init() {
  const rootElem = document.getElementById('app-root');
  const root = createRoot(rootElem);

  try {
    const theme = await loadTheme();

    root.render(
      <App theme={theme}>
        <AppRoutes theme={theme} />
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