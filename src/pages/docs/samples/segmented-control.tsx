import { useState } from 'react';
import { SegmentedControl } from '@/components/lede/segmented-control';

export function RangePicker() {
  const [range, setRange] = useState('Week');
  return <SegmentedControl label="Range" options={['Day', 'Week', 'Month']} value={range} onValueChange={setRange} />;
}
