import { Checkbox } from '@/components/lede/checkbox';

export function SummaryOptions() {
  return (
    <fieldset>
      <legend>Weekly summary</legend>
      <label className="ld-checkbox-field"><Checkbox name="email" defaultChecked /><span className="ld-checkbox-label">Email me a summary</span></label>
      <label className="ld-checkbox-field"><Checkbox name="archived" /><span className="ld-checkbox-label">Include archived items</span></label>
    </fieldset>
  );
}
