import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create one global QueryClient instance
const queryClient = new QueryClient();

export function QueryProvider({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
} 