// What the design system's cards (build-design-system.mjs) and the docs site's reference pages (scripts/llms/) both
// write about a registry item, from what scripts/design-system-api.mjs reads.

/** Text for one Markdown table cell: pipes escaped, on one line. */
export const cell = (text) => text.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

/** A component's props as a Markdown table: name, type, default and the prop's doc comment. */
export const propsTable = ({ props }) =>
  props.length
    ? ['| Prop | Type | Default | Description |', '| --- | --- | --- | --- |',
      ...props.map((p) => `| \`${p.name}\`${p.optional ? '' : ' (required)'} | \`${cell(p.type)}\` | ${p.default ? `\`${cell(p.default)}\`` : ''} | ${cell(p.description)} |`)].join('\n')
    : 'Only the HTML attributes of the element it renders.';

/** The components an item's title names that have props to list, such as `ListGroup` and `ListRow` for `list`. */
export const titledComponents = (item, api) => item.title.split(',').map((title) => title.trim()).filter((title) => api.has(title));
