import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import './index.css';
import './styles/datepicker.css';
import { AuthProvider } from './contexts/AuthContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 min before data is considered stale
      gcTime: 10 * 60 * 1000,           // 10 min garbage collection
      refetchOnWindowFocus: false,       // Prevent surprise refetches that trigger logout
      retry: (failureCount, error) => {
        // Never retry on auth errors - prevents multiple logout triggers
        if (error?.response?.status === 401 || error?.response?.status === 403 || error?.response?.status === 429) return false;
        return failureCount < 2;
      },
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
