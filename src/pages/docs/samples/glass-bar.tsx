import { GlassBar, GlassToolbar, GlassToolbarButton } from '@/components/lede/glass-bar';

export function PhotoChrome({ current, onShare }: { current: string; onShare: () => void }) {
  return (
    <>
      <GlassBar
        aria-label="Sections"
        placement="bottom"
        value={current}
        items={[{ value: 'home', label: 'Home', href: '/' }, { value: 'library', label: 'Library', href: '/library' }]}
      />
      <GlassToolbar aria-label="Photo tools" placement="top">
        <GlassToolbarButton onClick={onShare}>Share</GlassToolbarButton>
      </GlassToolbar>
    </>
  );
}
