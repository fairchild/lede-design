// Reduced motion's values are !important on :root and on every theme root, so a project that retunes a motion token
// after Lede's CSS, or through ThemeProvider's `tokens`, still gets 1ms and no spring under
// `prefers-reduced-motion: reduce`. Without the preference, the project's values show the override took effect.
import { test, expect, type Page } from '@playwright/test';

const CASES = [
  { reducedMotion: 'no-preference', duration: '0.3s', spring: 'ease-in' },
  { reducedMotion: 'reduce', duration: '0.001s', spring: 'linear' },
] as const;

// Transition lists are comma-separated, and a cubic-bezier() has commas of its own.
const list = (value: string) => value.split(/, (?![^(]*\))/);

async function transitions(page: Page, selector: string) {
  const s = await page.locator(selector).first().evaluate((el) => {
    const style = getComputedStyle(el);
    return { properties: style.transitionProperty, durations: style.transitionDuration, easings: style.transitionTimingFunction };
  });
  return { properties: list(s.properties), durations: list(s.durations), easings: list(s.easings) };
}

for (const { reducedMotion, duration, spring } of CASES) {
  test(`under ${reducedMotion}, a Button takes ${duration} and a ${spring} spring with motion tokens set on :root after Lede`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/components');
    await page.addStyleTag({ content: ':root { --duration-standard: 300ms; --easing-spring: ease-in; }' });
    const { properties, durations, easings } = await transitions(page, '.ld-btn');
    expect(properties).toContain('transform');
    expect(durations).toEqual(properties.map(() => duration));
    expect(easings[properties.indexOf('transform')]).toBe(spring);
  });

  // ThemeProvider writes `tokens` as inline custom properties on its .ld-theme[data-theme] wrapper; this builds the same.
  test(`under ${reducedMotion}, motion tokens set on a ThemeProvider's wrapper come to ${duration} and ${spring}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/components');
    await page.evaluate(() => {
      const wrapper = document.createElement('div');
      wrapper.className = 'ld-theme';
      wrapper.dataset.theme = 'light';
      wrapper.style.cssText = '--duration-standard: 300ms; --duration-quick: 300ms; --easing-spring: ease-in;';
      const probe = document.createElement('span');
      probe.className = 'probe';
      probe.style.transition = 'opacity var(--duration-standard) var(--easing-spring), transform var(--duration-quick) var(--easing-spring)';
      wrapper.append(probe);
      document.body.append(wrapper);
    });
    const { durations, easings } = await transitions(page, '.probe');
    expect(durations).toEqual([duration, duration]);
    expect(easings).toEqual([spring, spring]);
  });
}

// Data views move in duration-quick with the standard easing, which doesn't overshoot, and reduced motion reaches them.
for (const reducedMotion of ['no-preference', 'reduce'] as const) {
  test(`under ${reducedMotion}, a Checkbox and a collapsible Table's chevron take duration-quick without a spring`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto('/blocks/data-table');
    for (const selector of ['.ld-checkbox-box', '.ld-table-toggle-chevron']) {
      const { durations, easings } = await transitions(page, selector);
      expect(durations).toEqual(durations.map(() => (reducedMotion === 'reduce' ? '0.001s' : '0.15s')));
      expect(easings).toEqual(easings.map(() => 'cubic-bezier(0.2, 0.8, 0.2, 1)'));
    }
  });
}
