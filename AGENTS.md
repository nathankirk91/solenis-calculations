# Agent rules

Follow these rules for all work in this repository.

## React patterns

- Prefer **React Router framework** patterns (loaders, actions, forms, `useFetcher`, `useNavigation`, etc.) and **Conform** (`@conform-to/react`, `@conform-to/zod`) for form state, validation, and submission.
- Do **not** use `useState` or `useEffect` when React Router or Conform already covers the need (form values, validation errors, pending/submitting UI, data loading, redirects, revalidation).
- Only reach for `useState` / `useEffect` for truly client-only UI that cannot be expressed with loaders, actions, or Conform.

## Testing

- When adding a new feature, extend the test suite in the same change.
- Prefer the lightest layer that covers the risk:
  - **Unit** (`app/lib/*.test.mjs`) for pure logic and helpers.
  - **Integration** (`tests/integration/*.test.mjs`) for schemas, actions, and multi-module flows without a browser.
  - **End-to-end** (`tests/e2e/*.spec.ts`) for critical user journeys and auth gates.
- Run `npm test` for unit + integration. Run `npm run test:e2e` when UI or routing behaviour changes.
- Keep `test:calc` as an alias of `test:unit` for backwards compatibility.

## Git workflow

- Always work on the `main` branch.
- Do **not** create new branches.
- Do **not** create pull requests.
- Commit and push changes directly to `main`.
