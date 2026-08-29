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

The minimum supported Python version for these validators is Python 3.9. CI
must select or verify Python 3.9 or newer before invoking the frozen commands.

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

## Distinguishing CI Link vs Infrastructure Failures

Maintainers should distinguish between actual documentation link failures and external CI/action infrastructure errors:

- **Link-content failure (`Lychee`)**: The link checking step runs with `--verbose` and outputs the exact failing URL along with the HTTP status code (e.g. 404, 403). If a documentation URL is broken, update the link in the source Markdown. If a legitimate external host blocks shared CI runners or aggressively rate-limits CI automation, add a minimal, targeted exclusion in `.lychee.toml` with an explanatory comment.
- **Action-download / Runner infrastructure failure (GitHub 429/502/503)**: When GitHub Actions fails during action checkout or tool download before running the test steps, this is a transient infrastructure issue rather than a project defect. Rerun the workflow without modifying project files.
