import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4" role="alert" aria-live="assertive">
          <Card className="max-w-2xl w-full bg-black/40 backdrop-blur-xl border-white/10 p-8">
            <Alert variant="destructive" className="mb-6">
              <AlertTitle className="text-xl font-bold mb-2">
                Application Error
              </AlertTitle>
              <AlertDescription className="text-sm">
                We encountered an unexpected error. Your funds are safe. Please try reloading the page or contact support if the issue persists.
              </AlertDescription>
            </Alert>

            {this.state.error && (
              <div className="mb-6">
                <h3 className="text-white font-semibold mb-2">Error Details:</h3>
                <pre className="bg-black/60 text-red-400 p-4 rounded-lg overflow-auto text-xs border border-red-500/20">
                  {this.state.error.toString()}
                </pre>
              </div>
            )}

            {this.state.errorInfo && process.env.NODE_ENV === 'development' && (
              <div className="mb-6">
                <h3 className="text-white font-semibold mb-2">Component Stack:</h3>
                <pre className="bg-black/60 text-gray-400 p-4 rounded-lg overflow-auto text-xs border border-white/10 max-h-64">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}

            <div className="flex gap-4">
              <Button
                onClick={this.handleReset}
                className="flex-1 bg-purple-600 hover:bg-purple-700 min-h-[44px]"
                aria-label="Try to recover from error"
              >
                Try Again
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="flex-1 border-white/20 text-white hover:bg-white/10 min-h-[44px]"
                aria-label="Reload the entire page"
              >
                Reload Page
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
