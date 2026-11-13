import React from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('MicroFund UI error:', error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  goHome = () => {
    window.location.assign('/dashboard');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return <main className="error-boundary-page">
      <section className="error-boundary-card">
        <span className="error-boundary-icon"><AlertTriangle size={34} /></span>
        <span className="eyebrow">Display recovery</span>
        <h1>This page could not be displayed</h1>
        <p>The application caught an unexpected screen error instead of leaving the website blank. Reload the page or return to the dashboard.</p>
        {import.meta.env.DEV && this.state.error?.message && <code>{this.state.error.message}</code>}
        <div className="record-actions error-boundary-actions">
          <button className="button" type="button" onClick={this.reset}><RefreshCw size={17} />Reload page</button>
          <button className="button button-light" type="button" onClick={this.goHome}><Home size={17} />Dashboard</button>
        </div>
      </section>
    </main>;
  }
}
