import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { App } from './App';
import { AuthProvider } from './features/auth/AuthProvider';
import { ThemeProvider } from './components/ThemeProvider';
import './index.css';
const queryClient = new QueryClient({
    defaultOptions: {
        queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    },
});
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(ThemeProvider, { children: _jsxs(QueryClientProvider, { client: queryClient, children: [_jsx(BrowserRouter, { children: _jsx(AuthProvider, { children: _jsx(App, {}) }) }), _jsx(Toaster, { position: "bottom-right", theme: "system", closeButton: true, toastOptions: {
                        classNames: {
                            toast: 'rounded-sm border border-border bg-card text-card-foreground font-sans shadow-md',
                            title: 'font-serif text-[15px] tracking-tightest',
                            description: 'text-sm text-muted-foreground',
                            success: 'border-l-2 border-l-accent',
                            error: 'border-l-2 border-l-destructive',
                        },
                    } })] }) }) }));
