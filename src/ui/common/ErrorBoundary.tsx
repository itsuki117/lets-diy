import { Component, type ErrorInfo, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{ children: ReactNode; scope: 'app' | 'viewport' }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(`[${this.props.scope}]`, error, info); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="fallback" role="alert"><h3>{this.props.scope === 'viewport' ? '3D表示でエラーが発生しました' : '表示でエラーが発生しました'}</h3><p>編集内容は保持されています。保存してから再表示できます。</p><button onClick={() => this.setState({ failed: false })}>再初期化する</button></div>;
  }
}
