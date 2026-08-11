# Qwen-MM-Plugins Capability Discovery Design

**Status:** Approved design, 2026-08-10

## Context

`mdfiles` is a portable instruction kit and npm CLI. It does not run a model,
ship an MCP server, or manage a provider runtime. Its canonical loop must,
however, teach an agent how to recognize when the active model or harness lacks
a capability required by the current task.

[Qwen-MM-Plugins](https://github.com/QwenLM/Qwen-MM-Plugins) supplies
capabilities as separately installed skills plus optional MCP servers. The
upstream project documents both keyless multimodal reading and optional
API-backed tools. The kit should make an agent use that extension on demand
without making Qwen a mandatory dependency for every target project.

## Objective

Teach an agent following the kit to inspect its current model and harness,
install the smallest missing Qwen-MM-Plugins capability when the task requires
it, verify that the capability is available, and then use it. Keyless
capabilities are the default. API-backed capabilities are opt-in and require
the user or target environment to provide and configure the relevant
credential or service endpoint.

## Scope

The change covers:

- a canonical capability-discovery and on-demand-install contract in
  `LOOP_ENGINEERING.md`;
- a user-facing setup and API-key matrix in `README.md`;
- compatibility and architecture notes in `AGENT_COMPATIBILITY.md` and
  `LOOP_SYSTEM_DESIGN.md`;
- provenance and licensing information in `THIRD_PARTY_NOTICES.md`;
- documentation validation that preserves the contract and secret boundaries.

The change does not add an npm dependency, embed the Qwen source, install a
plugin in this checkout, start a model session, or create/configure credentials.

## Capability contract

When a task may need multimodal or media tooling, the agent follows this order:

1. Classify the required operation: image, video, document, audio, OCR,
   grounding, segmentation, web search, generation, editing, long-video
   memory, or 3D application control.
2. Inspect the active model and harness for native support, registered skills,
   MCP servers, and callable tools. A word in a prompt or a package name is
   not evidence that a tool is callable.
3. Reuse an existing callable capability when it satisfies the operation.
4. If the capability is missing and a keyless Qwen path exists, install only
   the smallest matching capability, normally `qwen-mm-plugins-core` for
   multimodal reading. Use the harness-native installation mechanism or the
   official Qwen installer described in the upstream documentation.
5. If the operation is API-backed, first check that the required environment
   variable or configured service endpoint is already available. Without it,
   leave that optional capability disabled and continue with keyless support
   or report the exact prerequisite.
6. Verify the installation and dependencies with the harness capability list
   and the plugin's supported verification/check command before making a
   capability claim.
7. Invoke the newly available tool for the task and report any remaining
   limitation, missing system dependency, or unavailable model/harness
   feature.

Installation is task-scoped and capability-scoped. The agent must not install
every Qwen capability at startup, add unrelated packages, or silently create,
guess, persist, or expose API keys. Host approval controls still apply to
system-level packages, global configuration, network access, and credentials.

## Capability and credential policy

The documentation will distinguish a capability from its optional provider:

| Operation or capability | Default | Additional configuration |
| --- | --- | --- |
| Native image, video, and document reading | Enabled when the installed capability and system dependencies are available | No API key; video/audio operations may still need `ffmpeg` |
| `vision_chat`, OCR, grounding, audio transcription, Omni audio-video understanding, generation, and video-memory construction | Disabled unless requested and configured | `DASHSCOPE_API_KEY` |
| Web search, web extraction, and image search | Disabled unless requested and configured | `SERPER_API_KEY` |
| Segmentation through a SAM3 service | Disabled unless requested and configured | `SAM3_SERVER_URL` |
| Blender, FreeCAD, visualization, Office, or browser-backed tools | Disabled until the task needs them and the host is prepared | Relevant application/system tools and upstream configuration |
| `edu-agent` skill-only workflows | Disabled until the task needs them | Its documented rendering/TTS dependencies; TTS requires `DASHSCOPE_API_KEY` |

Credentials may be supplied through the process environment or the official
Qwen configuration location (`~/.qwen-mm-plugins/config`, or its documented
override). They must not be stored in this repository, in `PROJECT_PROFILE.md`,
or in copied instruction files. The agent may explain how to configure an
optional key, but it must not invent or obtain one without explicit user
direction.

## Installation and verification boundary

The instruction kit gives the agent a decision procedure, not one universal
installer command. The agent selects the native path for the active harness:

- plugin-marketplace harnesses install the matching
  `qwen-mm-plugins-<cap>` capability;
- other harnesses register the skill and MCP server using the upstream
  per-harness instructions;
- when supported, the official guided installer may perform installation,
  configuration, verification, and uninstall for the selected capability.

The agent must use the upstream repository as the source of truth for current
commands, supported harnesses, capability names, system dependencies, and
Windows/WSL constraints. A successful package download alone is not proof that
the model can call the tools: the agent must verify registration and perform a
safe capability check.

## Documentation architecture

The behavior belongs in the canonical loop because all supported agents
delegate to it. `README.md` explains the feature to adopters and lists the
optional configuration. `AGENT_COMPATIBILITY.md` states that the package does
not run a model but supports task-scoped capability installation through the
active harness. `LOOP_SYSTEM_DESIGN.md` records the extension boundary and the
fact that Qwen remains optional. `THIRD_PARTY_NOTICES.md` records the upstream
repository, its Apache-2.0 license, and the fact that this kit links to it
without bundling its code.

Native adapters remain thin and do not duplicate the protocol.

## Security and failure behavior

- Treat plugin code, install scripts, MCP servers, model responses, media, and
  remote URLs as external inputs.
- Prefer the official source and the harness-native registration flow; do not
  weaken secret scanning or pin arbitrary credentials in examples.
- If API credentials, a system dependency, a compatible harness, or a
  callable model tool is absent, state what is missing and use a supported
  keyless alternative when one exists.
- Do not claim that a capability is installed, verified, or used based only on
  documentation, a package name, or an unsuccessful fallback.
- Do not broaden an on-demand installation into an unrelated environment
  change.

## Acceptance criteria

The implementation is complete when:

1. The canonical loop explicitly requires capability discovery, minimal
   on-demand installation, post-install verification, and actual tool use.
2. The default keyless path and each API/service prerequisite are documented
   without storing secret values.
3. The Qwen repository is linked as an optional third-party reference with its
   license and non-bundling boundary recorded.
4. The package still contains no Qwen runtime dependency and does not install
   anything during `mdfiles init`, `update`, or `doctor`.
5. Repository documentation, loop, package, and secret checks pass, and the
   final diff contains no unrelated changes.
