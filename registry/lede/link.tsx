import * as React from 'react';

/** Props every link component receives. A real anchor always renders, and a router only intercepts the navigation. */
export type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; ref?: React.Ref<HTMLAnchorElement> };
export type LinkComponent = React.ComponentType<LinkProps>;

const DefaultLink: LinkComponent = ({ ref, ...props }) => <a ref={ref} {...props} />;
const LinkContext = React.createContext<LinkComponent>(DefaultLink);

/**
 * Tells Lede components which link to render for an `href`, such as a React Router adapter:
 *   const RouterLink: LinkComponent = ({ href, ref, ...p }) => <Link to={href} ref={ref} {...p} />;
 *   <LinkProvider component={RouterLink}>…</LinkProvider>
 */
export function LinkProvider({ component, children }: { component: LinkComponent; children: React.ReactNode }) {
  return <LinkContext.Provider value={component}>{children}</LinkContext.Provider>;
}

/** The link component Lede renders for any `href`. */
export function useLinkComponent(): LinkComponent {
  return React.useContext(LinkContext);
}
