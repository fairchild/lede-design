import { AlertDialog } from '@/components/lede/alert-dialog';
import { Button } from '@/components/lede/button';

export function DeleteHost({ onDelete }: { onDelete: () => void }) {
  return (
    <AlertDialog
      trigger={<Button tone="critical">Delete edge-sfo-2</Button>}
      title="Delete edge-sfo-2?"
      description="Its 3 deploy runs go too. You can’t undo this."
      confirmLabel="Delete"
      tone="critical"
      onConfirm={onDelete}
    />
  );
}
