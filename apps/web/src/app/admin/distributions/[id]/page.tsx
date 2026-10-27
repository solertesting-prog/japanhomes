import { AdminDistributionDetail } from '@/components/admin/distributions';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminDistributionDetail id={id} />;
}
