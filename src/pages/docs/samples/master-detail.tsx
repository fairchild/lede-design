import { useState } from 'react';
import { MasterDetail } from '@/components/lede/blocks/master-detail';
import { SelectionBar } from '@/components/lede/blocks/selection-bar';
import { ListGroup, ListRow } from '@/components/lede/list';
import { Checkbox } from '@/components/lede/checkbox';

interface Message { id: string; subject: string; body: string }

// The selection lives in the route, so Back returns from the detail to the list.
export function Inbox({ messages, openId, onArchive }: { messages: Message[]; openId: string | null; onArchive: (ids: string[]) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const open = messages.find((m) => m.id === openId);
  const toggle = (id: string, on: boolean) => setPicked((p) => (on ? [...p, id] : p.filter((x) => x !== id)));
  return (
    <>
      <MasterDetail
        listLabel="Messages"
        detailLabel="Message"
        list={
          <ListGroup title="Inbox">
            {messages.map((m) => (
              <ListRow
                key={m.id}
                title={m.subject}
                href={`/inbox/${m.id}`}
                current={m.id === openId}
                control={<Checkbox aria-label={`Select ${m.subject}`} checked={picked.includes(m.id)} onChange={(e) => toggle(m.id, e.currentTarget.checked)} />}
              />
            ))}
          </ListGroup>
        }
        detail={open ? <article><h2>{open.subject}</h2><p>{open.body}</p></article> : null}
        empty={<p>Pick a message to read it.</p>}
      />
      <SelectionBar
        count={picked.length}
        noun={{ one: 'message', other: 'messages' }}
        actions={[{ label: 'Archive', onSelect: () => { onArchive(picked); setPicked([]); } }]}
        onClear={() => setPicked([])}
      />
    </>
  );
}
