#!/usr/bin/env python3
"""Validate the portable universal project-loop instruction kit."""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys
import tempfile


REQUIRED_FILES = (
    "LOOP_ENGINEERING.md",
    "GUIDE_ROUTER.md",
    "PROJECT_PROFILE.md",
    "LOOP_SYSTEM_DESIGN.md",
    "AGENTS.md",
    "CLAUDE.md",
    ".github/copilot-instructions.md",
    ".cursor/rules/project-loop.mdc",
)

ADAPTERS = (
    "AGENTS.md",
    "CLAUDE.md",
    ".github/copilot-instructions.md",
    ".cursor/rules/project-loop.mdc",
)

CANONICAL_REFERENCES = (
    "LOOP_ENGINEERING.md",
    "PROJECT_PROFILE.md",
    "GUIDE_ROUTER.md",
)

GUIDE_PAIRS = {
    "premium": ("PT-BR/premium-sites-studio-pt.md", "ENG/premium-sites-studio-eng.md"),
    "clean": ("PT-BR/clean-code-pt.md", "ENG/clean-code-eng.md"),
    "test": ("PT-BR/test-code-pt.md", "ENG/test-code-eng.md"),
    "security": ("PT-BR/sec-code-pt.md", "ENG/sec-code-eng.md"),
    "design": ("PT-BR/design-code-pt.md", "ENG/design-code-eng.md"),
    "performance": ("PT-BR/perf-code-pt.md", "ENG/perf-code-eng.md"),
    "accessibility": ("PT-BR/acessibilidade-code-pt.md", "ENG/accessibility-eng.md"),
    "games": ("PT-BR/games-code-design-web-pt.md", "ENG/games-code-design-web-eng.md"),
}

ROUTING_SCENARIOS = {
    "landing-page-premium": "premium,design,accessibility,clean,test,security,performance",
    "api-auth": "clean,test,security,performance",
    "bug-sem-interface": "clean,test",
    "app-mobile-ui": "clean,test,design,accessibility,security,performance",
    "game-web-multiplayer": "games,clean,test,security,performance,accessibility,design",
    "documentacao": "domain",
}


class ValidationError(RuntimeError):
    """Raised when the loop kit violates its structural contract."""


def validate_required_files(root: Path) -> None:
    for relative in REQUIRED_FILES:
        path = root / relative
        if not path.is_file():
            raise ValidationError(f"{relative}: missing required file")


def validate_adapters(root: Path) -> None:
    resolved_root = root.resolve()
    link_pattern = re.compile(r"\]\(([^)]+)\)")

    for relative in ADAPTERS:
        path = root / relative
        text = path.read_text(encoding="utf-8")
        line_count = len(text.splitlines())
        if line_count > 45:
            raise ValidationError(f"{relative}: adapter exceeds 45 lines ({line_count})")

        links = link_pattern.findall(text)
        for canonical in CANONICAL_REFERENCES:
            matching = [raw for raw in links if Path(raw.split("#", 1)[0]).name == canonical]
            if len(matching) != 1:
                raise ValidationError(
                    f"{relative}: missing canonical reference to {canonical}"
                )

            raw_target = matching[0].split("#", 1)[0]
            resolved = (path.parent / raw_target).resolve()
            try:
                resolved.relative_to(resolved_root)
            except ValueError as error:
                raise ValidationError(
                    f"{relative}: canonical reference escapes repository: {raw_target}"
                ) from error
            if not resolved.is_file():
                raise ValidationError(
                    f"{relative}: canonical reference target is missing: {raw_target}"
                )


def validate_router(root: Path) -> None:
    path = root / "GUIDE_ROUTER.md"
    text = path.read_text(encoding="utf-8")

    for guide_id, pair in GUIDE_PAIRS.items():
        if f"`{guide_id}`" not in text:
            raise ValidationError(f"GUIDE_ROUTER.md: missing guide ID {guide_id}")
        for relative in pair:
            if relative not in text:
                raise ValidationError(f"GUIDE_ROUTER.md: missing guide path {relative}")
            if not (root / relative).is_file():
                raise ValidationError(f"GUIDE_ROUTER.md: guide target is missing: {relative}")

    raw_markers = re.findall(r"<!--\s*route:(.*?)-->", text)
    for raw in raw_markers:
        if "PT-BR/" in raw or "ENG/" in raw or ".md" in raw:
            raise ValidationError(
                "GUIDE_ROUTER.md: route markers must use guide IDs, not language paths"
            )

    parsed: dict[str, str] = {}
    for raw in raw_markers:
        if "=" not in raw:
            raise ValidationError(f"GUIDE_ROUTER.md: malformed route marker: {raw}")
        scenario, guide_ids = (part.strip() for part in raw.split("=", 1))
        if scenario in parsed:
            raise ValidationError(f"GUIDE_ROUTER.md: duplicate routing scenario {scenario}")
        parsed[scenario] = guide_ids

    allowed = set(GUIDE_PAIRS) | {"domain"}
    for scenario, expected_ids in ROUTING_SCENARIOS.items():
        actual = parsed.get(scenario)
        if actual is None:
            raise ValidationError(f"GUIDE_ROUTER.md: missing routing scenario {scenario}")
        if actual != expected_ids:
            raise ValidationError(
                f"GUIDE_ROUTER.md: scenario {scenario} expected {expected_ids}, got {actual}"
            )
        unknown = set(actual.split(",")) - allowed
        if unknown:
            raise ValidationError(
                f"GUIDE_ROUTER.md: scenario {scenario} has unknown IDs: {sorted(unknown)}"
            )


def validate_profile(root: Path) -> None:
    path = root / "PROJECT_PROFILE.md"
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if len(lines) < 3 or lines[0] != "---":
        raise ValidationError("PROJECT_PROFILE.md: missing frontmatter")
    try:
        closing = lines.index("---", 1)
    except ValueError as error:
        raise ValidationError("PROJECT_PROFILE.md: unclosed frontmatter") from error

    metadata: dict[str, str] = {}
    for line in lines[1:closing]:
        if ":" not in line:
            raise ValidationError(f"PROJECT_PROFILE.md: malformed frontmatter line: {line}")
        key, value = (part.strip() for part in line.split(":", 1))
        if key in metadata:
            raise ValidationError(f"PROJECT_PROFILE.md: duplicate frontmatter key: {key}")
        metadata[key] = value.strip("\"'")

    allowed_values = {
        "language": {"pt-BR", "en"},
        "profile-mode": {"template", "project"},
        "profile-status": {"uninitialized", "partial", "verified"},
    }
    for key, values in allowed_values.items():
        if metadata.get(key) not in values:
            raise ValidationError(
                f"PROJECT_PROFILE.md: {key} must be one of {sorted(values)}"
            )

    secret_patterns = (
        re.compile(r"ghp_[A-Za-z0-9]{8,}"),
        re.compile(r"AKIA[0-9A-Z]{16}"),
        re.compile(r"BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY"),
        re.compile(
            r"(?im)^\s*(?:password|token|secret|api[_-]?key)\s*[:=]\s*"
            r"(?!unknown\b|example\b|<|\{|\[|não identificado\b).+"
        ),
    )
    for pattern in secret_patterns:
        if pattern.search(text):
            raise ValidationError("PROJECT_PROFILE.md: secret-like value detected")


def validate_cursor_frontmatter(root: Path) -> None:
    path = root / ".cursor/rules/project-loop.mdc"
    lines = path.read_text(encoding="utf-8").splitlines()
    if len(lines) < 4 or lines[0] != "---":
        raise ValidationError(f"{path.relative_to(root)}: missing frontmatter")
    try:
        closing = lines.index("---", 1)
    except ValueError as error:
        raise ValidationError(f"{path.relative_to(root)}: unclosed frontmatter") from error

    metadata: dict[str, str] = {}
    for line in lines[1:closing]:
        if ":" not in line:
            raise ValidationError(
                f"{path.relative_to(root)}: malformed frontmatter line: {line}"
            )
        key, value = (part.strip() for part in line.split(":", 1))
        metadata[key] = value
    if metadata.get("alwaysApply") != "true":
        raise ValidationError(f"{path.relative_to(root)}: alwaysApply must be true")
    if not metadata.get("description"):
        raise ValidationError(f"{path.relative_to(root)}: description is required")


def validate_repository(root: Path) -> None:
    validate_required_files(root)
    validate_adapters(root)
    validate_router(root)
    validate_profile(root)
    validate_cursor_frontmatter(root)


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def _valid_fixture(root: Path) -> None:
    guides = {
        "premium": ("PT-BR/premium-sites-studio-pt.md", "ENG/premium-sites-studio-eng.md"),
        "clean": ("PT-BR/clean-code-pt.md", "ENG/clean-code-eng.md"),
        "test": ("PT-BR/test-code-pt.md", "ENG/test-code-eng.md"),
        "security": ("PT-BR/sec-code-pt.md", "ENG/sec-code-eng.md"),
        "design": ("PT-BR/design-code-pt.md", "ENG/design-code-eng.md"),
        "performance": ("PT-BR/perf-code-pt.md", "ENG/perf-code-eng.md"),
        "accessibility": ("PT-BR/acessibilidade-code-pt.md", "ENG/accessibility-eng.md"),
        "games": ("PT-BR/games-code-design-web-pt.md", "ENG/games-code-design-web-eng.md"),
    }
    for pt_path, en_path in guides.values():
        _write(root / pt_path, "# Guia\n")
        _write(root / en_path, "# Guide\n")

    _write(root / "LOOP_ENGINEERING.md", "# Loop\n")
    _write(root / "LOOP_SYSTEM_DESIGN.md", "# Design\n")
    _write(
        root / "PROJECT_PROFILE.md",
        "---\nlanguage: pt-BR\nprofile-mode: template\n"
        "profile-status: uninitialized\nlast-confirmed: unknown\n---\n"
        "# Perfil\nNão identificado — confirmar pela fonte indicada\n",
    )

    catalog = "\n".join(
        f"| `{guide_id}` | [PT](./{pt_path}) | [EN](./{en_path}) |"
        for guide_id, (pt_path, en_path) in guides.items()
    )
    scenarios = {
        "landing-page-premium": "premium,design,accessibility,clean,test,security,performance",
        "api-auth": "clean,test,security,performance",
        "bug-sem-interface": "clean,test",
        "app-mobile-ui": "clean,test,design,accessibility,security,performance",
        "game-web-multiplayer": "games,clean,test,security,performance,accessibility,design",
        "documentacao": "domain",
    }
    markers = "\n".join(
        f"<!-- route:{scenario}={ids} -->" for scenario, ids in scenarios.items()
    )
    _write(root / "GUIDE_ROUTER.md", f"# Router\n{catalog}\n{markers}\n")

    root_adapter = (
        "# Adapter\n[Loop](./LOOP_ENGINEERING.md)\n"
        "[Profile](./PROJECT_PROFILE.md)\n[Router](./GUIDE_ROUTER.md)\n"
    )
    nested_adapter = (
        "# Adapter\n[Loop](../LOOP_ENGINEERING.md)\n"
        "[Profile](../PROJECT_PROFILE.md)\n[Router](../GUIDE_ROUTER.md)\n"
    )
    cursor_adapter = (
        "---\ndescription: Universal verified project loop\nalwaysApply: true\n---\n"
        "# Cursor\n[Loop](../../LOOP_ENGINEERING.md)\n"
        "[Profile](../../PROJECT_PROFILE.md)\n[Router](../../GUIDE_ROUTER.md)\n"
    )
    _write(root / "AGENTS.md", root_adapter)
    _write(root / "CLAUDE.md", root_adapter)
    _write(root / ".github/copilot-instructions.md", nested_adapter)
    _write(root / ".cursor/rules/project-loop.mdc", cursor_adapter)


def _expect_invalid(root: Path, expected_fragment: str) -> None:
    try:
        validate_repository(root)
    except ValidationError as error:
        if expected_fragment not in str(error):
            raise AssertionError(
                f"expected error containing {expected_fragment!r}, got {error!r}"
            ) from error
    else:
        raise AssertionError(f"expected ValidationError containing {expected_fragment!r}")


def run_self_tests() -> None:
    cases = 0

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        _valid_fixture(root)
        validate_repository(root)
        cases += 1

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        _valid_fixture(root)
        (root / "LOOP_ENGINEERING.md").unlink()
        _expect_invalid(root, "missing required file")
        cases += 1

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        _valid_fixture(root)
        _write(root / "AGENTS.md", "# Adapter\n[Loop](./LOOP_ENGINEERING.md)\n")
        _expect_invalid(root, "missing canonical reference")
        cases += 1

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        _valid_fixture(root)
        _write(root / "CLAUDE.md", "# Adapter\n" + "line\n" * 45)
        _expect_invalid(root, "exceeds 45 lines")
        cases += 1

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        _valid_fixture(root)
        router = (root / "GUIDE_ROUTER.md").read_text(encoding="utf-8")
        router = router.replace("[EN](./ENG/accessibility-eng.md)", "[EN](./ENG/missing.md)")
        _write(root / "GUIDE_ROUTER.md", router)
        _expect_invalid(root, "missing guide path")
        cases += 1

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        _valid_fixture(root)
        router = (root / "GUIDE_ROUTER.md").read_text(encoding="utf-8")
        router = router.replace(
            "<!-- route:api-auth=clean,test,security,performance -->",
            "<!-- route:api-auth=PT-BR/clean-code-pt.md,ENG/clean-code-eng.md -->",
        )
        _write(root / "GUIDE_ROUTER.md", router)
        _expect_invalid(root, "route markers must use guide IDs")
        cases += 1

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        _valid_fixture(root)
        profile = (root / "PROJECT_PROFILE.md").read_text(encoding="utf-8")
        _write(root / "PROJECT_PROFILE.md", profile + "token = live-value\n")
        _expect_invalid(root, "secret-like value")
        cases += 1

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        _valid_fixture(root)
        router = (root / "GUIDE_ROUTER.md").read_text(encoding="utf-8")
        router = router.replace("<!-- route:documentacao=domain -->", "")
        _write(root / "GUIDE_ROUTER.md", router)
        _expect_invalid(root, "missing routing scenario")
        cases += 1

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        _valid_fixture(root)
        cursor = (root / ".cursor/rules/project-loop.mdc").read_text(encoding="utf-8")
        _write(
            root / ".cursor/rules/project-loop.mdc",
            cursor.replace("alwaysApply: true", "alwaysApply: false"),
        )
        _expect_invalid(root, "alwaysApply")
        cases += 1

    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        outside = root.parent / f"{root.name}-outside"
        outside.mkdir()
        try:
            _valid_fixture(root)
            _write(outside / "LOOP_ENGINEERING.md", "# outside\n")
            adapter = (root / "AGENTS.md").read_text(encoding="utf-8")
            adapter = adapter.replace(
                "./LOOP_ENGINEERING.md",
                f"../{outside.name}/LOOP_ENGINEERING.md",
            )
            _write(root / "AGENTS.md", adapter)
            _expect_invalid(root, "escapes repository")
            cases += 1
        finally:
            (outside / "LOOP_ENGINEERING.md").unlink(missing_ok=True)
            outside.rmdir()

    print(f"loop self-tests passed: {cases} cases")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()

    try:
        if args.self_test:
            run_self_tests()
        else:
            validate_repository(args.root.resolve())
            print(
                "validated loop system: "
                f"{len(ADAPTERS)} adapters, {len(GUIDE_PAIRS)} bilingual pairs, "
                f"{len(ROUTING_SCENARIOS)} routing scenarios"
            )
        return 0
    except (ValidationError, AssertionError) as error:
        print(f"loop validation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
