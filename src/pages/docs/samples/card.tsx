import { Card } from '@/components/lede/card';

export function StorageCard({ available }: { available: number }) {
  return (
    <Card render={<article />} padding="md">
      <h3>Storage</h3>
      <p>{available} GB available</p>
    </Card>
  );
}
