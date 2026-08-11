# ForgeLoop conformance scenarios

These scenarios are adapter-facing contracts. They describe requests and the
artifacts a live agent must produce; they do not invoke a model runtime and are
not part of the deterministic `npm test` execution path.

Run a scenario in a disposable target, then validate it with:

```bash
npx @cassiomc1/forgeloop preflight --json
npx @cassiomc1/forgeloop audit --strict --json
```

The complete-website scenario deliberately fails when implementation starts
before the contract, route, and required gates exist.
