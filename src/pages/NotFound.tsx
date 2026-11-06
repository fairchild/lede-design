import { PageHeader } from '@lede/blocks/page-header';
import { Button } from '@lede/button';

/** A path outside the app: a page of its own, with the overview as the way on. */
export function NotFound() {
  return (
    <main id="main" className="onboarding-main" tabIndex={-1}>
      <div className="ld-flow ld-flow-narrow">
        <PageHeader title="Page not found" summary="It may have moved. The overview links to everything." />
        <div className="ld-flow-actions">
          <Button variant="filled" href="/">Go to the overview</Button>
        </div>
      </div>
    </main>
  );
}

/** A path inside the app: the app's navigation stays, and the page leads back to Today, as a missing work item leads back to Work. */
export function AppNotFound() {
  return (
    <div className="ld-flow">
      <PageHeader title="Page not found" summary="Daybook has no page at this address." back={{ href: '/app', label: 'Today' }} />
    </div>
  );
}
