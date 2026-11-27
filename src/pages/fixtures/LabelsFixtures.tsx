import * as React from 'react';
import { useSearchParams } from 'react-router';
import { AppShell, type AppShellLabels } from '@lede/blocks/app-shell';
import { WorkbenchShell, type WorkbenchShellLabels } from '@lede/blocks/workbench-shell';
import { StepIndicator, type StepIndicatorLabels } from '@lede/blocks/step-indicator';
import { AccentPicker, type AccentPickerLabels } from '@lede/blocks/accent-picker';
import { DataTable } from '@lede/blocks/data-table';
import type { Column, DataTableLabels, Selection, TableState } from '@lede/blocks/use-data-table';
import type { Preset } from '@lede/theme-provider';
import type { RowAction } from '@lede/list';

/**
 * Each block that says fixed words, with every one of them replaced, for tests/labels.spec.ts. `?part=app` shows an
 * AppShell, `?part=workbench` a WorkbenchShell and anything else the rest. Not linked from the navigation.
 */
const shell: Partial<AppShellLabels> = { skipToContent: 'Aller au contenu' };
const workbench: Partial<WorkbenchShellLabels> = {
  skipToContent: 'Aller au contenu',
  switcher: 'Volet',
  panel: (label) => `Volet ${label}`,
  resize: (label) => `Redimensionner ${label}`,
  collapsed: 'Replié',
  width: (px) => `${px} pixels de large`,
  notShowing: ({ label, switcher }) => `${label} n’est pas affiché. Choisissez-le sous ${switcher}.`,
};
const steps: Partial<StepIndicatorLabels> = {
  group: 'Progression',
  summary: ({ current, count, step }) => `Étape ${current} sur ${count} · ${step}`,
  completed: '(terminée)',
};
const accents: Partial<AccentPickerLabels> = { blue: 'Bleu', green: 'Vert' };

type Item = { id: string; name: string; size: number };
const ITEMS: Item[] = Array.from({ length: 3 }, (_, n) => ({ id: `f${n}`, name: `Fichier ${n + 1}`, size: 3 - n }));
const noun = { one: 'fichier', other: 'fichiers' };
const columns: Column<Item>[] = [
  { id: 'name', label: 'Nom', value: (r) => r.name, card: 'title', sortable: true },
  { id: 'size', label: 'Taille', value: (r) => r.size, card: 1, sortable: true },
];
const dir = (d: 'ascending' | 'descending') => (d === 'ascending' ? 'croissant' : 'décroissant');
const table: Partial<DataTableLabels> = {
  scope: (paged) => (paged ? 'sur cette page' : 'affichés'),
  selectAll: ({ noun: n, scope }) => `Tout sélectionner : ${n.other} ${scope}`,
  selectRow: (name) => `Sélectionner ${name}`,
  moreActions: (name) => `Plus d’actions pour ${name}`,
  actions: 'Actions de ligne',
  notSorted: 'Non trié',
  sortOption: ({ column, direction }) => `${column}, ${dir(direction)}`,
  sorted: ({ column, direction }) => `Trié par ${column}, ${dir(direction)}`,
  sortedDescription: (direction) => `Tri ${dir(direction)}`,
  ofTotal: ({ shown, total }) => `${shown} sur ${total}`,
  page: ({ page, count }) => `Page ${page} sur ${count}`,
  pageSelected: ({ counted, scope }) => `Les ${counted} ${scope} sont sélectionnés.`,
  selectAllMatching: ({ matching }) => `Sélectionner les ${matching}`,
  allSelected: ({ matching }) => `Les ${matching} sont sélectionnés.`,
  clearSelection: 'Effacer la sélection',
  loadFailed: ({ noun: n }) => `Impossible de charger les ${n.other}.`,
  tryAgain: 'Réessayer',
  empty: (n) => `Aucun ${n.one}`,
  pages: (n) => `Pages de ${n.other}`,
  previous: 'Précédente',
  next: 'Suivante',
  // An explicit `undefined` keeps the English default.
  sort: undefined,
  selectionBar: {
    selected: ({ counted, count }) => `${counted} ${count === 1 ? 'sélectionné' : 'sélectionnés'}`,
    shown: ({ number, count }) => `${number} ${count === 1 ? 'sélectionné' : 'sélectionnés'}`,
    done: 'Terminé',
  },
};
const actions = (r: Item): RowAction[] => [{ label: 'Ouvrir', onSelect: () => void r }];
const failed: TableState = { failure: { scope: 'load', retry: () => {} } };

function Tables() {
  const [selection, setSelection] = React.useState<Selection>({ kind: 'ids', ids: new Set() });
  const [page, setPage] = React.useState(0);
  const paging = React.useMemo(() => ({ kind: 'pages' as const, page, pageCount: 2, onPageChange: setPage }), [page]);
  return (
    <>
      <section aria-labelledby="lb-table" className="docs-section">
        <h2 id="lb-table" className="text-title-3">Table</h2>
        <DataTable
          aria-label="Fichiers"
          noun={noun}
          columns={columns}
          rows={ITEMS}
          getRowId={(r) => r.id}
          rowHeader="name"
          selectionMode="multiple"
          selection={selection}
          onSelectionChange={setSelection}
          total={6}
          paging={paging}
          rowActions={actions}
          bulkActions={[{ label: 'Archiver', onSelect: () => {} }]}
          labels={table}
        />
      </section>
      <section aria-labelledby="lb-cards" className="docs-section">
        <h2 id="lb-cards" className="text-title-3">Cards</h2>
        <DataTable aria-label="Fichiers en cartes" noun={noun} columns={columns} rows={ITEMS} getRowId={(r) => r.id} rowHeader="name" selectionMode="multiple" rowActions={actions} narrow="cards" narrowBelow={100000} labels={table} />
      </section>
      <section aria-labelledby="lb-empty" className="docs-section">
        <h2 id="lb-empty" className="text-title-3">Empty</h2>
        <DataTable aria-label="Aucun fichier" noun={noun} columns={columns} rows={[]} getRowId={(r) => r.id} rowHeader="name" labels={table} />
      </section>
      <section aria-labelledby="lb-failed" className="docs-section">
        <h2 id="lb-failed" className="text-title-3">Failed</h2>
        <DataTable aria-label="Échec" noun={noun} columns={columns} rows={[]} getRowId={(r) => r.id} rowHeader="name" state={failed} labels={table} />
      </section>
    </>
  );
}

export function LabelsFixtures() {
  const [params] = useSearchParams();
  const [accent, setAccent] = React.useState<Preset>('blue');
  const part = params.get('part');
  if (part === 'app') {
    return (
      <AppShell brand="Exemple" nav={[{ value: 'home', label: 'Accueil', href: '#' }]} current="home" navLabel="Principale" labels={shell}>
        <h1>Accueil</h1>
      </AppShell>
    );
  }
  if (part === 'workbench') {
    return (
      <WorkbenchShell brand="Exemple" title="Atelier" mainLabel="Contenu" start={{ label: 'Fichiers', content: <p>Liste</p> }} end={{ label: 'Aide', content: <p>Aide</p> }} labels={workbench}>
        <p>Contenu</p>
      </WorkbenchShell>
    );
  }
  return (
    <main id="main" tabIndex={-1}>
      <h1>Labels</h1>
      <StepIndicator steps={['Compte', 'Préférences', 'Fin']} current={1} labels={steps} />
      <fieldset>
        <legend>Couleur</legend>
        <AccentPicker value={accent} onValueChange={setAccent} labels={accents} />
      </fieldset>
      <Tables />
    </main>
  );
}
