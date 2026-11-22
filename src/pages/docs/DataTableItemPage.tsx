import { useParams, useSearchParams } from 'react-router';
import { bigWorkItems } from '@/data/work-items';
import { WorkItemView } from '@/pages/app/WorkPage';

const GUIDE = '/blocks/data-table';
const EXAMPLES = ['dt-client', 'dt-server', 'dt-search', 'dt-states', 'dt-narrow'] as const;
export type Example = (typeof EXAMPLES)[number];

/** A row's link inside the guide. `from` names the example it came from, so Back can return there. */
export const itemHref = (from: Example) => (row: { id: string }) => `${GUIDE}/items/${row.id}?from=${from}`;

/** Every row the guide's examples can show, whatever the demo app has archived since. */
const items = new Map(bigWorkItems.map((item) => [item.id, item]));

/** The guide's query as the reader left it, its examples' picks among them, so the back link returns to the same view. */
let guideSearch = '';
export const leaveGuide = (search: string) => { guideSearch = search; };

export const isExample = (value: string | null): value is Example => EXAMPLES.some((id) => id === value);

/** One work item inside the data table guide, with Back leading to the example the reader came from. */
export function DataTableItemPage() {
  const { id = '' } = useParams();
  const from = useSearchParams()[0].get('from');
  return <WorkItemView id={id} item={items.get(id)} back={{ href: `${GUIDE}${guideSearch}${isExample(from) ? `#${from}` : ''}`, label: 'Data table' }} />;
}
