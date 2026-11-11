import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { authMeQueryKey } from './api/@tanstack/react-query.gen';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './i18n';
import './index.css';

// When a session expires, queries answer 401: re-check the session, which shows the login.
// Not for the session check itself (a logged-out user would loop forever) and not for
// mutations (a failed login answers 401, too, and must show its error instead).
const meKey = JSON.stringify(authMeQueryKey());
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if ((error as { status?: number } | null)?.status !== 401 || JSON.stringify(query.queryKey) === meKey) return;
      void queryClient.invalidateQueries({ queryKey: authMeQueryKey() });
    },
  }),
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
