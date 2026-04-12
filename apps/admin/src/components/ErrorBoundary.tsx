import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from 'antd';
import { WarningOutlined, ReloadOutlined, HomeOutlined } from '@ant-design/icons';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary — catches rendering crashes in the page content area and
 * shows a friendly recovery card instead of white-screening the whole app.
 *
 * The sidebar and topbar remain functional so the admin can navigate away
 * or retry without a full browser refresh.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production this would report to Sentry / your error tracker.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-900/30 dark:text-rose-400">
          <WarningOutlined style={{ fontSize: 32 }} />
        </div>
        <div className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
          Rendering error
        </div>
        <h2 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Something went wrong
        </h2>
        <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
          This page crashed while rendering. The sidebar and topbar are still
          functional — you can navigate away or retry.
        </p>
        {this.state.error && (
          <pre className="mt-4 max-w-lg overflow-x-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-left font-mono text-xs text-slate-700 dark:border-white/[0.06] dark:bg-slate-900 dark:text-slate-300">
            {this.state.error.message}
          </pre>
        )}
        <div className="mt-6 flex items-center gap-2">
          <Button icon={<ReloadOutlined />} onClick={this.handleRetry}>
            Try again
          </Button>
          <Button type="primary" icon={<HomeOutlined />} onClick={this.handleGoHome}>
            Go home
          </Button>
        </div>
      </div>
    );
  }
}
