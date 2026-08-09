#!/usr/bin/env python3
"""Validate the English-only repository contract."""

from __future__ import annotations

import argparse
from pathlib import Path
import re
import sys


GUIDES = (
    "ENG/accessibility-eng.md",
    "ENG/clean-code-eng.md",
    "ENG/design-code-eng.md",
    "ENG/games-code-design-web-eng.md",
    "ENG/perf-code-eng.md",
    "ENG/premium-sites-studio-eng.md",
    "ENG/sec-code-eng.md",
    "ENG/test-code-eng.md",
)
REQUIRED_FRONTMATTER = {
    "name",
    "language",
    "description",
    "version",
    "last-reviewed",
}
TEXT_SUFFIXES = {
    ".json",
    ".jsonc",
    ".md",
    ".mdc",
    ".py",
    ".toml",
    ".txt",
    ".yaml",
    ".yml",
}
TEXT_FILENAMES = {".gitignore"}
EXCLUDED_PARTS = {".git", ".worktrees", "__pycache__", ".commandcode"}
PORTUGUESE_WORDS = (
    "acessibilidade",
    "alteração",
    "animações",
    "aplicável",
    "arquivo",
    "arquivos",
    "atualize",
    "código",
    "comandos",
    "conteúdo",
    "documentação",
    "evidência",
    "execução",
    "ferramenta",
    "ferramentas",
    "fontes",
    "guia",
    "guias",
    "inglês",
    "inicializar",
    "instalação",
    "manutenção",
    "não",
    "obrigatório",
    "português",
    "primeira",
    "projeto",
    "repositório",
    "segurança",
    "somente",
    "usuário",
    "validação",
    "verificação",
)
PORTUGUESE_TEXT = re.compile(
    r"(?i)\b(?:" + "|".join(re.escape(word) for word in PORTUGUESE_WORDS) + r")\b"
)
INLINE_CODE = re.compile(r"(?<!`)`[^`\n]+`(?!`)")
URL = re.compile(r"https?://\S+")


class ValidationError(RuntimeError):
    """Raised when the current tree violates the English-only contract."""


def parse_frontmatter(path: Path) -> dict[str, str]:
    """Parse the constrained guide frontmatter."""

    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0] != "---":
        raise ValidationError(f"{path}: missing frontmatter")
    try:
        closing = lines.index("---", 1)
    except ValueError as error:
        raise ValidationError(f"{path}: unclosed frontmatter") from error

    metadata: dict[str, str] = {}
    for line in lines[1:closing]:
        if ":" not in line:
            raise ValidationError(f"{path}: malformed frontmatter line")
        key, value = (part.strip() for part in line.split(":", 1))
        if key == "counterpart":
            raise ValidationError(f"{path}: counterpart metadata is forbidden")
        if key in metadata:
            raise ValidationError(f"{path}: duplicate frontmatter key {key}")
        metadata[key] = value.strip("\"'")

    if set(metadata) != REQUIRED_FRONTMATTER:
        raise ValidationError(f"{path}: frontmatter keys differ from English contract")
    if metadata["language"] != "en":
        raise ValidationError(f"{path}: language must be en")
    if metadata["name"] != path.stem:
        raise ValidationError(f"{path}: name must match filename")
    return metadata


def validate_guide_tree(root: Path) -> None:
    """Validate the canonical English guide paths and metadata."""

    if (root / "PT-BR").exists():
        raise ValidationError("PT-BR directory is forbidden")

    expected = {Path(relative) for relative in GUIDES}
    actual = {
        path.relative_to(root)
        for path in (root / "ENG").glob("*.md")
        if path.is_file()
    }
    if actual != expected:
        raise ValidationError("English guide set differs from canonical catalog")

    for relative in GUIDES:
        parse_frontmatter(root / relative)


def validate_routes(root: Path) -> None:
    """Reject legacy route identifiers and require their English replacements."""

    path = root / "GUIDE_ROUTER.md"
    if not path.is_file():
        raise ValidationError("GUIDE_ROUTER.md is missing")
    text = path.read_text(encoding="utf-8")
    if "bug-sem-interface" in text or "documentacao" in text:
        raise ValidationError("legacy Portuguese route identifier detected")
    for marker in ("route:bug-without-ui=", "route:documentation="):
        if marker not in text:
            raise ValidationError(f"GUIDE_ROUTER.md: missing English route {marker}")


def should_scan_path(path: Path) -> bool:
    """Return whether a path contains repository-maintained text."""

    if EXCLUDED_PARTS.intersection(path.parts):
        return False
    return path.name in TEXT_FILENAMES or path.suffix.lower() in TEXT_SUFFIXES


def iter_text_files(root: Path):
    """Yield maintained text files from the current tree."""

    for path in sorted(root.rglob("*")):
        if path.is_file() and not path.is_symlink():
            relative = path.relative_to(root)
            if should_scan_path(relative):
                yield path, relative


def prose_for_language_scan(text: str) -> str:
    """Remove URLs and inline technical identifiers before prose scanning."""

    return URL.sub("", INLINE_CODE.sub("", text))


def validate_language(root: Path) -> int:
    """Reject known Portuguese operational prose and return the file count."""

    count = 0
    for path, relative in iter_text_files(root):
        count += 1
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        searchable = prose_for_language_scan(text)
        match = PORTUGUESE_TEXT.search(searchable)
        if match:
            line = searchable.count("\n", 0, match.start()) + 1
            raise ValidationError(
                f"{relative}:{line}: Portuguese text detected [{match.group(0)}]"
            )
    return count


def validate_repository(root: Path) -> int:
    """Validate the full English-only repository contract."""

    resolved = root.resolve()
    validate_guide_tree(resolved)
    validate_routes(resolved)
    return validate_language(resolved)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    args = parser.parse_args()

    try:
        count = validate_repository(args.root)
        print(f"validated English-only repository: 8 guides, {count} text files")
        return 0
    except ValidationError as error:
        print(f"English-only validation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
