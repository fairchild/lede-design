import { Button } from '@lede/button';
import { server, WorkPage } from '@/pages/app/WorkPage';

/** For tests, not linked from the navigation: the Work page with a way to make a whole archive request fail. */
export function WorkArchiveFixture() {
  return (
    <>
      <Button variant="gray" onClick={server.failNextRequest}>Fail the next request</Button>
      <WorkPage />
    </>
  );
}
