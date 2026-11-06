import { Button } from '@/components/lede/button';

export function SaveBar({ onSave }: { onSave: () => void }) {
  return (
    <div>
      <Button variant="filled" onClick={onSave}>Save</Button>
      <Button variant="plain" href="/help/saving">Learn more</Button>
    </div>
  );
}
