import { Disclosure } from '@/components/lede/disclosure';

export function WeekSummary() {
  return (
    <Disclosure title="This week" summary="2 decisions need you by Thursday" meta="2">
      <p>The budget review and the launch date.</p>
    </Disclosure>
  );
}
