import { Link } from 'react-router';
import type { LinkComponent } from '@lede/link';
import { useSiteHref } from '@/view-params';

/**
 * Lede renders this for every href: still a real <a>, with client-side navigation for in-app paths. An in-app path
 * carries the look and the appearance in its query, so the next page shows them and its link does too.
 */
export const RouterLink: LinkComponent = ({ href, ref, ...props }) => {
  const site = useSiteHref();
  return /^(https?:|mailto:|tel:|#)/.test(href) ? <a ref={ref} href={href} {...props} /> : <Link ref={ref} to={site(href)} {...props} />;
};
