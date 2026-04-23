import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useEffect, useState } from 'react';
const ThemeCtx = createContext(null);
const KEY = 'tmj.provider.theme';
export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        const stored = localStorage.getItem(KEY);
        if (stored)
            return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    });
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem(KEY, theme);
    }, [theme]);
    return (_jsx(ThemeCtx.Provider, { value: { theme, toggle: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')) }, children: children }));
}
export function useTheme() {
    const ctx = useContext(ThemeCtx);
    if (!ctx)
        throw new Error('useTheme outside ThemeProvider');
    return ctx;
}
