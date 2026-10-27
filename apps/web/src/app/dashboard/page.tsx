import type { Metadata } from 'next';
import { DashboardView } from '@/components/app/dashboard-view';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } };

export default function Page() {
  return <DashboardView />;
}
