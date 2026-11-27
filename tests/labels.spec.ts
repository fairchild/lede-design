import { test, expect, type Page } from '@playwright/test';

// Each block's fixed words can be replaced through `labels`, and words left out stay English.
// src/pages/fixtures/LabelsFixtures.tsx replaces them with French ones.
const ROUTE = '/fixtures/labels';
const politeAnnouncer = (page: Page) => page.locator('[data-live-announcer] [aria-live="polite"]');

test.describe('labels', () => {
  test.skip(({ isMobile }) => isMobile, 'Words, not layout: one window covers them.');

  test('AppShell: the skip link', async ({ page }) => {
    await page.goto(`${ROUTE}?part=app`);
    await expect(page.getByRole('link', { name: 'Aller au contenu' })).toHaveAttribute('href', '#main');
  });

  test('WorkbenchShell: toggles, dividers, main, the switcher and the note in place of main', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${ROUTE}?part=workbench`);
    await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeAttached();
    await expect(page.getByRole('button', { name: 'Volet Fichiers' })).toBeVisible();
    await expect(page.getByRole('main', { name: 'Volet Contenu' })).toBeVisible();
    const divider = page.getByRole('separator', { name: 'Redimensionner Aide' });
    await expect(divider).toHaveAttribute('aria-valuetext', '280 pixels de large');
    await page.getByRole('button', { name: 'Volet Aide' }).click();
    await expect(divider).toHaveAttribute('aria-valuetext', 'Replié');

    await page.setViewportSize({ width: 400, height: 800 });
    const switcher = page.getByRole('group', { name: 'Volet' });
    await switcher.getByRole('radio', { name: 'Fichiers' }).check();
    await expect(page.getByText('Contenu n’est pas affiché. Choisissez-le sous Volet.')).toBeAttached();
  });

  test('StepIndicator and AccentPicker', async ({ page }) => {
    await page.goto(ROUTE);
    const steps = page.getByRole('group', { name: 'Progression' });
    await expect(steps).toBeVisible();
    await expect(steps.locator('.ld-steps-summary')).toHaveText('Étape 2 sur 3 · Préférences');
    await expect(steps.getByRole('listitem').first()).toHaveText(/Compte\s*\(terminée\)/);
    await expect(page.getByRole('radio', { name: 'Bleu' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Vert' })).toBeVisible();
    // Left out, so English.
    await expect(page.getByRole('radio', { name: 'Teal' })).toBeVisible();
  });

  test('DataTable as a table: summary, header, rows, sort, selection, the bar and the pager', async ({ page }) => {
    await page.goto(ROUTE);
    const section = page.getByRole('region', { name: 'Table' });
    await expect(section.locator('.ld-dt-summary')).toHaveText('Page 1 sur 2 · 3 sur 6 fichiers');
    await expect(section.getByRole('columnheader', { name: 'Actions de ligne' })).toBeAttached();
    await expect(section.getByRole('button', { name: 'Plus d’actions pour Fichier 1' })).toBeAttached();

    const sort = section.getByRole('button', { name: 'Nom' });
    await sort.click();
    await expect(politeAnnouncer(page)).toHaveText('Trié par Nom, croissant');
    await expect(sort).toHaveAccessibleDescription('Tri croissant');

    await section.getByRole('checkbox', { name: 'Sélectionner Fichier 2' }).check();
    const bar = page.getByRole('toolbar', { name: '1 fichier sélectionné' });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Terminé' })).toBeVisible();
    await expect(bar.locator('.ld-selection-count')).toHaveText('1 sélectionné');

    await section.getByRole('checkbox', { name: 'Tout sélectionner : fichiers sur cette page' }).check();
    await expect(section.getByText('Les 3 fichiers sur cette page sont sélectionnés.')).toBeVisible();
    await section.getByRole('button', { name: 'Sélectionner les 6 fichiers' }).click();
    await expect(section.getByText('Les 6 fichiers sont sélectionnés.')).toBeVisible();
    await expect(section.getByRole('button', { name: 'Effacer la sélection' })).toBeVisible();

    const pager = section.getByRole('navigation', { name: 'Pages de fichiers' });
    await expect(pager.getByText('Page 1 sur 2')).toBeVisible();
    await expect(pager.getByRole('button', { name: 'Précédente' })).toBeVisible();
    await pager.getByRole('button', { name: 'Suivante' }).click();
    await expect(pager.getByText('Page 2 sur 2')).toBeVisible();
  });

  test('DataTable as cards: the bar above them, sort options and row controls', async ({ page }) => {
    await page.goto(ROUTE);
    const section = page.getByRole('region', { name: 'Cards' });
    await expect(section.getByRole('checkbox', { name: 'Tout sélectionner : fichiers affichés' })).toBeVisible();
    // `sort` is set to `undefined`, which keeps the English default.
    const select = section.getByRole('combobox', { name: 'Sort' });
    await expect(select.locator('option')).toHaveText(['Non trié', 'Nom, croissant', 'Nom, décroissant', 'Taille, croissant', 'Taille, décroissant']);
    await expect(section.getByRole('checkbox', { name: 'Sélectionner Fichier 1' })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Plus d’actions pour Fichier 1' })).toBeVisible();
  });

  test('DataTable empty and failed', async ({ page }) => {
    await page.goto(ROUTE);
    await expect(page.getByRole('region', { name: 'Empty' }).getByText('Aucun fichier')).toBeVisible();
    const failed = page.getByRole('region', { name: 'Failed' });
    await expect(failed.getByRole('alert')).toContainText('Impossible de charger les fichiers.');
    await expect(failed.getByRole('button', { name: 'Réessayer' })).toBeVisible();
  });
});
