import { Link } from 'react-router';
import type { LinkComponent } from '@lede/link';

/** Lede renders this for every href: still a real <a>, with client-side navigation for in-app paths. */
export const RouterLink: LinkComponent = ({ href, ref, ...props }) =>
  /^(https?:|mailto:|tel:|#)/.test(href) ? <a ref={ref} href={href} {...props} /> : <Link ref={ref} to={href} {...props} />;
