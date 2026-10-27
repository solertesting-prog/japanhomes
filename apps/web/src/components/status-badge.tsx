import { Badge } from '@jpt/ui';
import type { FundingStatus } from '@jpt/shared';

const TONE: Record<FundingStatus, 'open' | 'soon' | 'funded' | 'closed'> = {
  OPEN: 'open',
  COMING_SOON: 'soon',
  FUNDED: 'funded',
  CLOSED: 'closed',
};

export function StatusBadge({ status, label }: { status: FundingStatus; label: string }) {
  return (
    <Badge tone={TONE[status]}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </Badge>
  );
}

export function DemoBadge() {
  return <Badge tone="demo">DEMO</Badge>;
}
