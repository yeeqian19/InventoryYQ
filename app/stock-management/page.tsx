import StockClient from './StockClient';

export const metadata = {
  title: 'Stock Management | Inventory Panel',
  description: 'Manage inventory thresholds and reorder links.',
};

export default function StockManagementPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <StockClient />
    </main>
  );
}