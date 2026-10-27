import type { Metadata } from 'next';
import { Suspense } from 'react';
import { KycView } from '@/components/app/kyc-view';

export const metadata: Metadata = { title: 'Verify identity', robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <KycView />
    </Suspense>
  );
}
