import React from "react";

// Catches any render error so a broken subtree never blanks the whole site.
// Shows a minimal fallback that matches the brand.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("[paara] render error:", error, info);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[60vh] bg-sand text-cocoa font-body flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <h1 className="font-display text-3xl mb-3">Something rippled the wrong way</h1>
          <p className="text-sm text-cocoa/60 mb-6">
            A small glitch stopped this part from rendering. Try again, or head back home.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={this.handleReset}
              className="bg-gold text-white px-6 py-3 text-xs uppercase tracking-widest hover:bg-cocoa transition-colors"
            >
              Try again
            </button>
            <a
              href="/"
              className="border border-cocoa/30 px-6 py-3 text-xs uppercase tracking-widest hover:bg-cocoa hover:text-white hover:border-cocoa transition-colors"
            >
              Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
