import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create one global QueryClient instance
const queryClient = new QueryClient();

function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold" style={{ color: 'var(--brand, #D9232E)' }}>
        QR Menu
      </h1>
      <p className="mt-4 text-gray-600">Welcome to the QR Menu demo app.</p>
      <p className="text-sm mt-2 text-gray-400">(UI components coming soon)</p>
    </div>
  );
}

export function App({ theme }) {
  // theme prop is currently unused (UI components will use CSS vars)
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/*" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
} 