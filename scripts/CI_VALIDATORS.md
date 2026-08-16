# Frozen CI-only validators

The Python validators are retained as compatibility checks for repository
contracts that predate the Node test suite:

- `validate_markdown.py` checks Markdown structure, frontmatter, links, code
  fences, guide metadata, and adapter/documentation consistency.
- `validate_loop_system.py` checks the universal loop, instruction boundaries,
  routing metadata, and protocol wording.
- `scan_secrets.py` checks repository text for secret-shaped values and is also
  exercised by its Python unit tests.

They are deliberately frozen as CI-only tooling. The current migration does
not replace them with a second Node implementation because doing so would
change the historical scanner and validator contracts without a dedicated
parity project. They are not runtime dependencies, are not shipped as the CLI
runtime, and are not required by `npm install`.

## CI invocation

```bash
python3 -m unittest discover -s tests -v
python3 scripts/validate_markdown.py --self-test
python3 scripts/validate_markdown.py
python3 scripts/validate_loop_system.py --self-test
python3 scripts/validate_loop_system.py
python3 scripts/scan_secrets.py
```

The Node suite and Python suite have separate ownership: Node tests cover CLI,
protocol behavior, schemas, and execution evidence; Python remains the
compatibility gate for these repository-wide textual invariants.
