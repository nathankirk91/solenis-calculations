# Agent rules

Follow these rules for all work in this repository.

## React patterns

- Prefer **React Router framework** patterns (loaders, actions, forms, `useFetcher`, `useNavigation`, etc.) and **Conform** (`@conform-to/react`, `@conform-to/zod`) for form state, validation, and submission.
- Do **not** use `useState` or `useEffect` when React Router or Conform already covers the need (form values, validation errors, pending/submitting UI, data loading, redirects, revalidation).
- Only reach for `useState` / `useEffect` for truly client-only UI that cannot be expressed with loaders, actions, or Conform.

## Git workflow

- Always work on the `main` branch.
- Do **not** create new branches.
- Do **not** create pull requests.
- Commit and push changes directly to `main`.
