import { Component, ReactNode } from "react";

interface State { hasError: boolean; error?: Error }

class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(error: Error) { console.error("ErrorBoundary:", error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-3">
          <h1 className="text-2xl font-medium">Algo deu errado</h1>
          <p className="text-sm text-muted-foreground">{this.state.error?.message}</p>
          <button onClick={() => location.reload()} className="text-sm underline">Recarregar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
