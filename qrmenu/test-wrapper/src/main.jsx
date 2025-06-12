import { loadTheme } from '@qrmenu/theme-loader';
import { App } from '@qrmenu/core';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MasonryFeed } from '@qrmenu/ui';
import { useMenu } from '@qrmenu/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockItems = [
  { id: 'burger', kind: 'food', name: 'Burger', price: 199, image_url: 'https://picsum.photos/300?1' },
  { id: 'promo42', kind: 'promotion', image_url: 'https://picsum.photos/600/300?2', fullBleed: true },
  { id: 'pizza', kind: 'food', name: 'Veg Pizza', price: 299, image_url: 'https://picsum.photos/300?3' },
  { id: 'story21', kind: 'video', url: 'https://www.w3schools.com/html/mov_bbb.mp4', poster: 'https://picsum.photos/800/450?4', fullBleed: true },
];

const qc = new QueryClient();

function MenuFeed() {
  const { data, fetchNextPage, hasNextPage, isLoading, error } = useMenu();

  const fetchedItems = data ? data.pages.flatMap((p) => p.items) : [];
  // Transform API data to add missing 'kind' property and filter out any undefined items
  const transformedItems = fetchedItems
    .filter(item => item && item.id) // Filter out undefined/null items
    .map(item => ({
      ...item,
      kind: 'food', // Add the required 'kind' property for FeedItemSwitcher
    }));
  
  const items = transformedItems.length > 0 ? transformedItems : mockItems;

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
    <div style={{ 
      width: '100%', 
      maxWidth: '100%', 
      padding: '0px',
      boxSizing: 'border-box',
      overflowX: 'hidden',
    }}>
      <MasonryFeed
        items={items}
        loadMore={() => fetchNextPage()}
        hasMore={!!hasNextPage}
        gap={4}
      />
    </div>
  );
}

// Mobile-optimized app wrapper
function MobileAppWrapper({ theme }) {
  return (
    <div style={{
      width: '100%',
      maxWidth: '100vw',
      overflowX: 'hidden',
      margin: 0,
      padding: 0
    }}>
      <div style={{ 
        padding: '10px',
        background: 'var(--background, #f8f9fa)',
        borderTop: '2px solid var(--brand, #D9232E)',
        minHeight: '50px'
      }}>
        <h3 style={{ 
          margin: 0, 
          color: 'var(--brand, #D9232E)',
          fontSize: '18px'
        }}>
          Live Menu Feed
        </h3>
        <p style={{ 
          margin: '5px 0', 
          fontSize: '14px',
          color: 'var(--text, #666)'
        }}>
          Attempting to load from API: {import.meta.env.VITE_API_BASE || 'http://localhost:8005'}
        </p>
      </div>
      <MenuFeed />
    </div>
  );
}

async function init() {
  const statusEl = document.getElementById('status');
  const themeInfoEl = document.getElementById('theme-info');
  
  try {
    const theme = await loadTheme();

    statusEl.className = 'status success';
    statusEl.textContent = 'Theme loaded successfully!';

    themeInfoEl.innerHTML = `
      <pre style="background:#f5f5f5;padding:10px;border-radius:4px;overflow:auto;">
${JSON.stringify(theme, null, 2)}
      </pre>
    `;

    const rootElem = document.getElementById('app-root');
    const root = createRoot(rootElem);
    root.render(
      <QueryClientProvider client={qc}>
        <MobileAppWrapper theme={theme} />
      </QueryClientProvider>
    );
  } catch (error) {
    statusEl.className = 'status error';
    statusEl.textContent = `Failed to load theme: ${error.message}`;
    console.error('Theme loading failed:', error);
  }
}

init(); 