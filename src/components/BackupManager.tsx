import React, { useEffect, useState } from 'react';
import { getSavedAdminKey } from '../excelEngine';

type Entry = { name: string; bytes: number; created: string };
export function BackupManager() {
  const [items, setItems] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function request(action: string, name?: string) {
    const data = new FormData();
    data.set('action', action); data.set('admin_key', getSavedAdminKey() || '');
    if (name) data.set('name', name);
    const res = await fetch('./sync-catalog.php', { method: 'POST', body: data });
    if (!res.headers.get('content-type')?.includes(action === 'backup_download' ? 'application/zip' : 'application/json')) throw new Error('این قابلیت به هاست PHP با افزونه ZIP و تنظیم مسیر خصوصی نیاز دارد.');
    if (action === 'backup_download' && res.ok) return res.blob();
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.error || 'خطا در پشتیبان‌گیری');
    return json;
  }
  async function refresh() { const result = await request('backup_list'); setItems(result.backups); }
  useEffect(() => { refresh().catch(e => setMessage(String(e.message))); }, []);
  async function run(action: string, name?: string) {
    setBusy(true); setMessage('');
    try {
      const result = await request(action, name);
      if (action === 'backup_download') {
        const url = URL.createObjectURL(result); const link = document.createElement('a'); link.href = url; link.download = name!; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      } else { setMessage('نسخه پشتیبان با موفقیت ساخته شد.'); await refresh(); }
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="bg-white border rounded-2xl p-5 space-y-4">
    <h2 className="font-bold">پشتیبان‌گیری ۳۰روزه</h2>
    <p className="text-sm leading-7">نسخه کامل پایگاه داده JSON و پوشه‌های data، uploads و assets در مسیر خصوصی خارج از ریشه سایت ذخیره می‌شود. فایل‌های قدیمی‌تر از ۳۰ روز حذف می‌شوند. اجرای روزانه نیازمند نصب Cron طبق راهنماست؛ این پنل به‌تنهایی زمان‌بندی را فعال نمی‌کند.</p>
    <button type="button" disabled={busy} onClick={() => run('backup_now')} className="bg-brand text-white px-4 py-2 rounded-xl disabled:opacity-50">{busy ? 'در حال اجرا...' : 'پشتیبان‌گیری اکنون'}</button>
    <p role="status" className="text-sm">{message}</p>
    {items.map(item => <div key={item.name} className="border rounded-xl p-3 flex flex-wrap items-center gap-3 text-xs"><bdi className="break-all">{item.name}</bdi><span>{(item.bytes / 1024).toFixed(1)} KB</span><time>{item.created}</time><button type="button" disabled={busy} onClick={() => run('backup_download', item.name)} className="text-brand font-bold">دانلود امن</button></div>)}
  </section>;
}
