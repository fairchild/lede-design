import type { Spec } from '@json-render/core';
import { SpecView } from '@/components/lede/json-render/spec-view';

// A spec, such as a model's reply, drawn with Lede. Its switches are bound to the spec's own state.
const spec: Spec = {
  root: 'screen',
  state: { alerts: { push: true } },
  elements: {
    screen: { type: 'Screen', props: {}, children: ['header', 'delivery'] },
    header: { type: 'PageHeader', props: { title: 'Notifications', summary: 'Choose where alerts reach you.' }, children: [] },
    delivery: { type: 'ListGroup', props: { title: 'Delivery' }, children: ['push'] },
    push: { type: 'ListRow', props: { title: 'Push alerts', checked: { $bindState: '/alerts/push' } }, children: [] },
  },
};

export function Notifications() {
  return <SpecView spec={spec} />;
}
