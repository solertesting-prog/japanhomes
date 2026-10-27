import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignUpForm } from '@/components/app/auth-forms';

export const metadata: Metadata = { title: 'Create account', robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
