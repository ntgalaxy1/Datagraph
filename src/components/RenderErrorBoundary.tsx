import React from 'react';

/** Keep runtime failures visible and recoverable instead of unmounting the app. */
export class RenderErrorBoundary extends React.Component<React.PropsWithChildren, { error: string | null }> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('DataGraph render failed', error, info);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return <section dir="rtl" role="alert" className="max-w-3xl mx-auto my-10 bg-white border border-red-200 rounded-2xl p-6 text-slate-900">
      <h2 className="text-lg font-bold">نمایش این بخش با خطا مواجه شد</h2>
      <p className="my-3 text-sm">به‌جای صفحه سفید، جزئیات خطا اینجا نمایش داده می‌شود. لطفاً متن زیر را برای پشتیبانی ارسال کنید.</p>
      <pre dir="ltr" className="whitespace-pre-wrap break-words text-left p-3 bg-slate-100 rounded-lg text-xs">{this.state.error}</pre>
      <button type="button" className="mt-4 rounded-xl bg-brand text-white px-4 py-2" onClick={() => window.location.reload()}>بارگذاری مجدد برنامه</button>
    </section>;
  }
}
