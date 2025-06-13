import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create one global QueryClient instance
const queryClient = new QueryClient();

export function App({ children, theme }) {
  // Core App provides only the essential providers
  // UI orchestration is handled by screens in @qrmenu/ui
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
} 