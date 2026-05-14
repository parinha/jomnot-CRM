'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  screenName?: string;
}

interface State {
  error: Error | null;
}

export default class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error(`[${this.props.screenName ?? 'Screen'}] crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
          <svg
            className="w-10 h-10 text-yellow-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-zinc-100">Something went wrong</h2>
          <p className="text-sm text-zinc-400 max-w-sm break-words">{this.state.error.message}</p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 rounded-lg bg-yellow-400 text-zinc-900 text-sm font-semibold hover:bg-yellow-300 active:bg-yellow-500 transition"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
