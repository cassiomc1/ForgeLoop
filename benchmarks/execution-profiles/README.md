# Adaptive execution-profile benchmark scenarios

These scenarios define the deterministic routing inputs used to compare direct
execution, the historical balanced workflow, and the adaptive ForgeLoop
workflow. They are scenario specifications, not provider measurements.

Record provider or host usage only when it is actually reported. Keep unknown
token, cache, cost, and timing values as `null`; ForgeLoop must not estimate
them. A comparison is valid only when task/scenario, model, provider, prompt or
spec fingerprint, project revision, benchmark version, and environment class
match.

The target profile is a guidance expectation. It does not change lifecycle
phases, required gates, verification truth, authority boundaries, or validated
completion.

The required reference set includes the six original scenarios and
`novatask-saas-landing-page.json`. NovaTask represents the original small SaaS
landing-page workload: HTML5, CSS3, vanilla JavaScript, local static files,
and no external services, auth, secrets, or publication. Its canonical
`executionProfile.resolved` value is `light`.

Record these dimensions independently when a real run is available: input and
output tokens, cache reads and writes, total tokens, wall-clock time,
verification status, verification cycles, comparable steps, visual quality,
responsive quality, accessibility basics, interaction polish, and requirement
completeness. Unavailable provider or reviewer measurements remain `null` or
`NOT_AVAILABLE`; they are never inferred.

Hosts may add optional `contextUsage` to a raw run with `HOST_REPORTED` values
for task context, guides, history, protocol instructions, repository context,
and other context. Use `UNKNOWN` with null items when unavailable. Complete
light-versus-balanced context observations may report `CONTEXT_INFLATION`; the
status is observational and never a lifecycle gate.

For UI scenarios, an independent evaluator or blind human review may also
report 0–5 scores for visual quality, responsive quality, accessibility,
interaction polish, and requirements completeness. Missing scores remain null;
implementer self-ratings are not an independent quality source.

Initial non-blocking efficiency goals for LIGHT scenarios are P50 token
overhead of at most +35% and P95 token overhead of at most +60% against a
comparable direct baseline. These are benchmark objectives, not completion
rules, and quality or verification coverage may not be traded for them.
