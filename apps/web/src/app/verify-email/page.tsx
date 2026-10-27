import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyEmail } from '@/components/app/auth-forms';

export const metadata: Metadata = { title: 'Confirm email', robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
