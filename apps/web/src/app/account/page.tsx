import type { Metadata } from 'next';
import { AccountView } from '@/components/app/account-view';

export const metadata: Metadata = { title: 'Account', robots: { index: false } };

export default function Page() {
  return <AccountView />;
}
