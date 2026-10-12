# Atomic Design Methodology for EMSIDS Leave Portal

## Purpose

Use this file as the operating guide for changing the leave-management portal into a well-structured atomic design system.

The goal is **not** to rewrite the UI or change user-visible behavior. The goal is to make responsibilities explicit, make reusable components predictable, and make each change small, testable, and reversible.

## Core Rules

1. Preserve existing behavior, markup, classes, accessibility, and visual output unless the task explicitly requests a change.
2. Never make a broad structural refactor in one commit.
3. Make each change focused on one component boundary.
4. Write or update tests before changing production behavior.
5. Keep database access in services.
6. Keep business rules out of React presentation components.
7. Keep feature-specific state in hooks or feature contexts, not in generic UI atoms.
8. Do not add a component simply because it might be useful later.
9. Do not rename or move files without first recording the behavior contract.
10. Run the relevant tests and build after every meaningful change.

## Atomic Design Levels

### Atoms

Atoms are the smallest reusable visual or interactive elements. Classification is based on responsibility, not component size or visual complexity.

Examples:

- Button
- Field
- IconButton
- Chip
- SegmentedControl
- PageHead
- StatusPill
- Toast
- Donut
- WarnBanner

Rules:

- Atoms must not call Supabase.
- Atoms must not contain feature-specific business logic.
- Atoms may receive props and render them.
- Atoms must be reusable from at least two contexts or be part of an established primitive contract.
- Atoms must preserve their current classes, DOM structure, and accessibility semantics unless explicitly requested.
- An atom must not own a complete user workflow such as a confirmation interaction.

### Molecules

Molecules combine multiple atoms into a reusable interaction or feature fragment.

Examples:

- ConfirmModal
- PanelTable
- Balance summary
- Balance bar row
- Request action group
- Request status filter
- Profile detail row
- Empty-state block
- Quick-action card

Rules:

- Molecules may combine atoms, own a small interaction, and consume a focused hook.
- Molecules must not directly import Supabase or own unrelated feature state.
- Molecules should expose a stable, understandable prop contract.
- Molecules should not become large page-level implementations.
- ConfirmModal is a molecule because it owns a complete confirmation interaction: dialog semantics, focus management, dismissal behavior, and confirmation/cancellation actions.
- The generic dialog shell, if introduced, should remain an atom. Feature-specific confirmation flows should remain in the relevant organism or feature hook.

### Organisms

Organisms are complete feature sections composed from atoms and molecules.

Examples:

- Leave request form
- Leave request queue
- Leave request history
- Dashboard overview
- Balance overview
- Holiday calendar
- Navigation drawer
- Profile menu
- Chat panel

Rules:

- Organisms own their feature-local state.
- Organisms may coordinate child components and call feature hooks.
- Organisms must not contain unowned page-level responsibilities.
- Organisms should remain independently testable.

### Pages

Pages are route-level compositions.

Rules:

- Pages should compose organisms and route-level context.
- Pages should not directly query Supabase.
- Pages should not contain large helper implementations.
- Pages should not own generic component behavior.
- Page components may use guards, routing, page metadata, and feature hooks.

### Features

A feature is a domain concept such as leave requests, balances, holidays, employees, or separations.

Rules:

- Feature rules belong in services, hooks, or utilities.
- Feature-specific status and mode values come from the shared constants.
- Feature mutations must use the existing service-layer contract returning `{ data, error }`.
- Feature data mapping belongs in the store mapping layer or a dedicated mapper.

## Recommended Source Organization

Do not remove the existing visual contract. Prefer adding a clear hierarchy around the current files.

```text
src/
├── components/
│   ├── ui/
│   │   ├── atoms/
│   │   ├── molecules/
│   │   └── index.jsx
│   └── feature/
│       ├── leave-request-form/
│       ├── leave-request-queue/
│       ├── leave-request-history/
│       └── dashboard-overview/
├── features/
│   ├── leave-requests/
│   ├── balances/
│   ├── holidays/
│   └── separations/
├── hooks/
├── pages/
├── services/
├── store/
└── utils/
```

If the existing file shape is retained, document the component level beside the component or in its test file. Do not duplicate a feature in both a current directory and a new directory unless the legacy export is being migrated.

## Module Boundaries

### UI Components May

- Import shared constants and utilities.
- Receive props.
- Render state and events.
- Use accessibility helpers.
- Compose lower-level atoms and molecules.

### UI Components Must Not

- Import Supabase.
- Call leave-request service functions directly.
- Own authentication state.
- Implement domain validation.
- Contain unrelated page behavior.
- Import another page.

### Hooks May

- Own feature-local state.
- Call services.
- Map service results into feature state.
- Coordinate mutations and refreshes.
- Use React hooks and shared contexts.

### Hooks Must Not

- Import UI components.
- Export generic rendering helpers.
- Hide domain rules that should be tested independently.
- Own global application state unless the hook is specifically constructing that context.

### Services May

- Import the shared Supabase client.
- Normalize errors.
- Execute database queries.
- Perform service-level mappings only when required by the existing contract.

### Services Must Not

- Import React components.
- Import page components.
- Hiddenly perform UI or route changes.
- Depend on UI state.

## Workflow for Every Atomic Design Task

### 1. Identify the boundary

State the component level and ownership:

- Atom
- Molecule
- Organism
- Page
- Feature
- Service
- Utility

Also identify the observable behavior that must not change.

### 2. Inspect existing usage

Find all callers and tests before changing the component. Include:

- Imports
- JSX usage
- Unit tests
- Visual or end-to-end tests
- CSS class dependencies
- Accessibility expectations

### 3. Establish a failing or regression test

For behavior changes, write a focused test first. For structural refactors, add or update the smallest test that proves:

- The public props contract remains valid.
- The component renders the same meaningful output.
- State transitions remain correct.
- Errors and loading states remain correct.
- The component is accessible.

Do not test implementation details or mocks only.

### 4. Extract one boundary at a time

Use this sequence:

1. Extract pure calculations.
2. Extract a service operation.
3. Extract a focused hook.
4. Extract a molecule.
5. Extract an organism.
6. Simplify the page.

Do not combine these steps unless they are inseparable.

### 5. Preserve compatibility

When moving code:

- Keep the existing public export where practical.
- Keep shared CSS classes unchanged.
- Keep the same DOM hierarchy where practical.
- Preserve error messages and user-facing wording unless requested.
- Keep tests pointing at the existing route and component behavior.

### 6. Verify

Run the smallest relevant test first, then the broad verification commands:

```powershell
npm test
npm run build
npm run lint
```

Run end-to-end tests only when the change affects real user flows, authentication, database mutations, or visible route behavior.

## Mandatory Testing Expectations

### Unit tests

Place tests beside the corresponding source area:

```text
tests/unit/components/ui/
tests/unit/hooks/
tests/unit/services/
tests/unit/store/
tests/unit/utils/
```

Use realistic behavior tests. Do not add production-only methods for tests.

### Visual checks

Do not change CSS or element structure without a visual baseline check. Preserve the existing class parity contract.

### E2E tests

E2E tests should cover real user goals and real database flows. Unit tests should remain fully mocked at the Supabase boundary.

## Atomic Design Naming

Use stable names that describe role not implementation:

- `LeaveRequestForm` rather than `LeaveFormV2`
- `RequestHistoryTable` rather than `TableContainer`
- `BalanceSummary` rather than `BalanceBlock`
- `RequestActions` rather than `ActionButtons`

Do not create names containing unnecessary implementation detail.

## Refactoring Rules for This Repository

The protected existing contracts are:

- Routes in [src/App.jsx](src/App.jsx)
- Reusable primitives in [src/components/ui](src/components/ui)
- Shared state in [src/store/AuthContext.jsx](src/store/AuthContext.jsx)
- Service functions in [src/services](src/services)
- Date and business-rule utilities in [src/utils](src/utils)
- Current pages in [src/pages](src/pages)
- Existing CSS classes in [src/styles](src/styles)
- Unit and visual tests under [tests](tests)

Do not bypass these contracts when extracting atomic components. The atom and molecule layer must depend on them rather than reimplementing them.

## Testing Third-Party and External Dependencies

- Supabase must remain behind the service layer.
- Authentication must remain in the context layer.
- No page may directly invoke Supabase.
- No UI component may import a page.
- No service may import a page or UI component.
- No hook may render UI.

## Required Final Response

After a refactoring task, report:

1. Files or component boundaries changed.
2. The atomic level of each change.
3. Tests added or updated.
4. Existing behavior preserved or intentionally changed.
5. Validation commands run and their outcomes.
6. Any remaining technical debt or compatibility risk.

Do not claim completion unless the relevant test, lint, and build commands were run successfully in the current working tree.

## Workflow Example

When asked to refactor a page:

```text
Inspect current page and its callers
  ↓
Identify reusable behavior and data responsibilities
  ↓
Write a focused regression test
  ↓
Extract one atom or molecule
  ↓
Verify the relevant test
  ↓
Extract the next feature boundary
  ↓
Run unit tests, lint, and build
  ↓
Report the final component structure
```

Use this workflow for every atomic-design implementation. Do not skip the test-first or verification steps.
