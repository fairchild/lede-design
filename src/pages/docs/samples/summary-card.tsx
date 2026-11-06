import { SummaryCard } from '@/components/lede/blocks/summary-card';

export function DecisionsCard({ due }: { due: number }) {
  return (
    <SummaryCard
      title="Decisions"
      figure={due}
      summary="Both due by Thursday."
      status={{ tone: 'caution', label: 'Needs you' }}
      href="/decisions"
    />
  );
}
