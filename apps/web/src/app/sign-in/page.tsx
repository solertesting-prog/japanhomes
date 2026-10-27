import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInForm } from '@/components/app/auth-forms';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
