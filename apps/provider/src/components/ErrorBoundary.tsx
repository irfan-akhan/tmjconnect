import { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Keep a local trail — production telemetry would ship this to Sentry.
    console.error('[RouteErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="mx-auto max-w-2xl py-20">
        <div className="relative overflow-hidden rounded-sm border border-destructive/30 bg-destructive/5 p-10">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5 stroke-[1.5]" />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-destructive">
              Something stopped working
            </div>
          </div>
          <h1 className="font-serif text-4xl tracking-tightest">
            This view <em>hit a snag.</em>
          </h1>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            The error is local to this page — the rest of the portal is still
            usable. You can try again or navigate elsewhere.
          </p>

          <details className="mt-6 rounded-sm border border-border/70 bg-background p-3">
            <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Technical detail
            </summary>
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-foreground">
              {error.name}: {error.message}
              {error.stack ? '\n\n' + error.stack.split('\n').slice(0, 6).join('\n') : ''}
            </pre>
          </details>

          <div className="mt-8 flex gap-2">
            <Button onClick={this.reset}>
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
