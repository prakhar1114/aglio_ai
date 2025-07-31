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
        <MenuScreen 
          enableCallWaiter={false}
          showToWaiter={true}
          message="Please go to the counter to make the payment and confirm."
          enablePlaceOrder={false}
          showAskNameModal={false}
        />
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
