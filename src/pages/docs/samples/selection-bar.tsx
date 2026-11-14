import { SelectionBar } from '@/components/lede/blocks/selection-bar';

// Floats on glass while anything is selected, and hides at zero. Done, or Escape, clears the selection.
export function BulkActions({ picked, onArchive, onDelete, onClear }: { picked: string[]; onArchive: () => void; onDelete: () => void; onClear: () => void }) {
  return (
    <SelectionBar
      count={picked.length}
      noun={{ one: 'message', other: 'messages' }}
      actions={[{ label: 'Archive', onSelect: onArchive }, { label: 'Delete', tone: 'critical', onSelect: onDelete }]}
      onClear={onClear}
    />
  );
}
