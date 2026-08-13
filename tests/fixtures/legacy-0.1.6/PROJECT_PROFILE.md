---
language: en
profile-mode: template
profile-status: uninitialized
last-confirmed: unknown
---

# Project Profile

> Durable context for [Loop Engineering](./LOOP_ENGINEERING.md). Fill it only
> with evidence from the target project.

## Maintenance rules

- Update a fact only after inspecting authoritative files, commands, or sources.
- Preserve `profile-mode: template` while maintaining this source kit. In a target project with product code or manifests, change it to `project` during the first discovery cycle.
- Record the source for every material fact.
- Never store secrets, tokens, passwords, private keys, or raw credentials.
- Preserve explicit project decisions until newer evidence replaces them.
- Set `profile-status` to `verified` only when the stack, essential architecture, and critical commands have evidence.
- Keep `language: en`; this kit has no alternate language variant.
- Do not use this file as a task diary.

## Product and objective

| Field | Current state | Source |
| --- | --- | --- |
| Product | Not identified — confirm from the stated source | Source not identified |
| Users | Not identified — confirm from the stated source | Source not identified |
| Primary outcome | Not identified — confirm from the stated source | Source not identified |
| Durable exclusions | Not identified — confirm from the stated source | Source not identified |

## Confirmed stack

| Layer | Technology and version | Source |
| --- | --- | --- |
| Frontend | Not identified — confirm from the stated source | Source not identified |
| Backend | Not identified — confirm from the stated source | Source not identified |
| Mobile | Not identified — confirm from the stated source | Source not identified |
| Desktop | Not identified — confirm from the stated source | Source not identified |
| Data | Not identified — confirm from the stated source | Source not identified |
| Infrastructure | Not identified — confirm from the stated source | Source not identified |

Record a missing manifest or configuration as verified absence. Do not infer a
stack from technology names found only in documentation or examples.

## Official commands

| Purpose | Confirmed command | Source |
| --- | --- | --- |
| Installation | Not identified — confirm from the stated source | Source not identified |
| Development | Not identified — confirm from the stated source | Source not identified |
| Specific test | Not identified — confirm from the stated source | Source not identified |
| Full test suite | Not identified — confirm from the stated source | Source not identified |
| Lint and formatting | Not identified — confirm from the stated source | Source not identified |
| Typecheck | Not identified — confirm from the stated source | Source not identified |
| Build | Not identified — confirm from the stated source | Source not identified |
| Additional validation | Not identified — confirm from the stated source | Source not identified |

Never invent a command when the project already declares official scripts or
automation.

## Architecture and directories

| Area | Path or responsibility | Source |
| --- | --- | --- |
| Primary entry point | Not identified — confirm from the stated source | Source not identified |
| Domain | Not identified — confirm from the stated source | Source not identified |
| Interfaces | Not identified — confirm from the stated source | Source not identified |
| Persistence | Not identified — confirm from the stated source | Source not identified |
| Tests | Not identified — confirm from the stated source | Source not identified |
| Documentation | Not identified — confirm from the stated source | Source not identified |
| CI/CD | Not identified — confirm from the stated source | Source not identified |

## Supported platforms

| Surface | Confirmed targets | Evidence |
| --- | --- | --- |
| Web | Not identified — confirm from the stated source | Source not identified |
| Mobile | Not identified — confirm from the stated source | Source not identified |
| Desktop | Not identified — confirm from the stated source | Source not identified |
| Browsers and devices | Not identified — confirm from the stated source | Source not identified |
| Accessibility requirements | Not identified — confirm from the stated source | Source not identified |

## Services and risk surfaces

| Item | Use and risk | Safe source |
| --- | --- | --- |
| Authentication and authorization | Not identified — confirm from the stated source | Source not identified |
| External APIs | Not identified — confirm from the stated source | Source not identified |
| Personal or sensitive data | Not identified — confirm from the stated source | Source not identified |
| Uploads and files | Not identified — confirm from the stated source | Source not identified |
| Payments | Not identified — confirm from the stated source | Source not identified |
| Queues, webhooks, and jobs | Not identified — confirm from the stated source | Source not identified |
| Deployment and production | Not identified — confirm from the stated source | Source not identified |

Record only the mechanism and safe configuration location. Never copy credential
values.

## Constraints and decisions

| Decision or constraint | State | Source |
| --- | --- | --- |
| Required conventions | Not identified — confirm from the stated source | Source not identified |
| Compatibility | Not identified — confirm from the stated source | Source not identified |
| Performance budgets | Not identified — confirm from the stated source | Source not identified |
| Legal and license constraints | Not identified — confirm from the stated source | Source not identified |
| Operations requiring approval | Not identified — confirm from the stated source | Source not identified |

## Unverified items

- Not identified — confirm from the stated source.

Remove an item from this section only after adding evidence and moving it to the
appropriate section.

## Evidence

| Date | Confirmed fact | Source or command | Scope |
| --- | --- | --- | --- |
| Not identified | Not identified — confirm from the stated source | Source not identified | Not identified |

Keep evidence concise. Long outputs, temporary logs, and per-task history do not
belong in this file.
