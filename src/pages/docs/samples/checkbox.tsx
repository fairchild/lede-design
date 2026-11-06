import { Checkbox } from '@/components/lede/checkbox';

export function SummaryOptions() {
  return (
    <fieldset>
      <legend>Weekly summary</legend>
      <label><Checkbox name="email" defaultChecked /> Email me a summary</label>
      <label><Checkbox name="archived" /> Include archived items</label>
    </fieldset>
  );
}
