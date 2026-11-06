import * as React from 'react';
import { useSearchParams } from 'react-router';
import { Button } from '@lede/button';
import { WorkbenchShell } from '@lede/blocks/workbench-shell';
import { TextField } from '@lede/text-field';
import { RouterLink } from '@/router-link';
import { SAMPLE_CHAT, SAMPLE_FILES, type ChatMessage, type SampleFile } from '@/data/workbench';
import { IconFile, IconFolder } from '@/icons';
import { EMBEDDED } from './embedded';

const FOLDERS = [...new Set(SAMPLE_FILES.map((file) => file.folder))].sort((a, b) => (a && b ? a.localeCompare(b) : a ? -1 : 1));
const REPLY = 'This is sample data, so nothing was sent.';

function FileTree({ open }: { open: SampleFile }) {
  const row = (file: SampleFile) => (
    <li key={file.path}>
      <RouterLink className="docs-wb-file" href={`/layouts/workbench?file=${encodeURIComponent(file.path)}`} aria-current={file === open ? 'page' : undefined}>
        <span className="docs-wb-icon" aria-hidden="true"><IconFile /></span>
        <span>{file.name}</span>
      </RouterLink>
    </li>
  );
  return (
    <>
      <h2 className="docs-wb-heading">Files</h2>
      <ul className="docs-wb-tree">
        {FOLDERS.map((folder) => {
          const files = SAMPLE_FILES.filter((file) => file.folder === folder);
          if (!folder) return files.map(row);
          return (
            <li key={folder}>
              <span className="docs-wb-folder"><span className="docs-wb-icon" aria-hidden="true"><IconFolder /></span>{folder}</span>
              <ul className="docs-wb-tree docs-wb-nested">{files.map(row)}</ul>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Editor({ file, status }: { file: SampleFile; status: string }) {
  return (
    <article className="docs-wb-doc">
      <header className="docs-wb-doc-head">
        <h2 className="docs-wb-path">{file.path}</h2>
        <p className="docs-wb-meta">{file.language} · {file.lines.length} lines</p>
        <p className="docs-wb-meta" role="status">{status}</p>
      </header>
      <pre className="docs-wb-code"><code>{file.lines.map((line, index) => <span key={index} className="docs-wb-line">{line || ' '}</span>)}</code></pre>
    </article>
  );
}

function Assistant() {
  const [messages, setMessages] = React.useState(SAMPLE_CHAT);
  const [draft, setDraft] = React.useState('');
  const send = (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    const id = messages.length + 1;
    const next: ChatMessage[] = [{ id, from: 'you', text: draft }, { id: id + 1, from: 'assistant', text: REPLY }];
    setMessages([...messages, ...next]);
    setDraft('');
  };
  return (
    <div className="docs-wb-assistant">
      <h2 className="docs-wb-heading">Assistant</h2>
      <div role="log" aria-label="Conversation">
        <ol className="docs-wb-chat">
          {messages.map((message) => (
            <li key={message.id} className="docs-wb-message" data-from={message.from}>
              <p className="docs-wb-who">{message.from === 'you' ? 'You' : 'Assistant'}</p>
              <p>{message.text}</p>
            </li>
          ))}
        </ol>
      </div>
      <form className="docs-wb-composer" onSubmit={send}>
        <TextField label="Message" value={draft} onChange={(event) => setDraft(event.target.value)} autoComplete="off" />
        <Button type="submit" variant="filled" size="sm">Send</Button>
      </form>
    </div>
  );
}

/** WorkbenchShell at full size, dressed as a small coding tool. */
export function WorkbenchExample() {
  const [params] = useSearchParams();
  const file = SAMPLE_FILES.find((candidate) => candidate.path === params.get('file')) ?? SAMPLE_FILES[0];
  const [checks, setChecks] = React.useState('Checks not run');
  return (
    <WorkbenchShell
      brand={EMBEDDED ? 'Sample project' : <RouterLink className="docs-wb-back" href="/layouts">Layouts</RouterLink>}
      title={file.name}
      actions={<Button variant="tinted" size="sm" onClick={() => setChecks('12 checks passed')}>Run checks</Button>}
      start={{ label: 'Files', content: <FileTree open={file} />, defaultWidth: 240 }}
      end={{ label: 'Assistant', content: <Assistant />, defaultWidth: 320 }}
      mainLabel="Editor"
      storageKey={EMBEDDED ? undefined : 'lede:workbench'}
    >
      <Editor file={file} status={checks} />
    </WorkbenchShell>
  );
}
