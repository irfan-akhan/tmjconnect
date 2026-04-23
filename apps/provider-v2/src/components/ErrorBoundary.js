import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
export class RouteErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidCatch(error, info) {
        // Keep a local trail — production telemetry would ship this to Sentry.
        console.error('[RouteErrorBoundary]', error, info.componentStack);
    }
    reset = () => this.setState({ error: null });
    render() {
        const { error } = this.state;
        if (!error)
            return this.props.children;
        return (_jsx("div", { className: "mx-auto max-w-2xl py-20", children: _jsxs("div", { className: "relative overflow-hidden rounded-sm border border-destructive/30 bg-destructive/5 p-10", children: [_jsxs("div", { className: "mb-6 flex items-center gap-3", children: [_jsx("div", { className: "flex h-10 w-10 items-center justify-center rounded-sm bg-destructive/10 text-destructive", children: _jsx(AlertTriangle, { className: "h-5 w-5 stroke-[1.5]" }) }), _jsx("div", { className: "font-mono text-[10px] uppercase tracking-[0.3em] text-destructive", children: "Something stopped working" })] }), _jsxs("h1", { className: "font-serif text-4xl tracking-tightest", children: ["This view ", _jsx("em", { children: "hit a snag." })] }), _jsx("p", { className: "mt-3 max-w-md text-sm text-muted-foreground", children: "The error is local to this page \u2014 the rest of the portal is still usable. You can try again or navigate elsewhere." }), _jsxs("details", { className: "mt-6 rounded-sm border border-border/70 bg-background p-3", children: [_jsx("summary", { className: "cursor-pointer font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground", children: "Technical detail" }), _jsxs("pre", { className: "mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground", children: [error.name, ": ", error.message, error.stack ? '\n\n' + error.stack.split('\n').slice(0, 6).join('\n') : ''] })] }), _jsxs("div", { className: "mt-8 flex gap-2", children: [_jsxs(Button, { onClick: this.reset, children: [_jsx(RefreshCw, { className: "h-4 w-4" }), "Try again"] }), _jsx(Button, { variant: "outline", onClick: () => window.location.reload(), children: "Reload page" })] })] }) }));
    }
}
