#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(repositoryRoot, "package.json");
const outputSvgPath = path.join(repositoryRoot, "docs", "assets", "forgeloop-flow.svg");

// Read package version dynamically
const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const version = pkg.version || "0.1.11";

// Theme constants - Tokyo Night / Modern Engineering Dark
const THEME = {
  bg: "#0f1117",
  panel: "#16161e",
  panelSecondary: "#1a1b26",
  panelHeader: "#13141c",
  border: "#292e42",
  borderSubtle: "#1f2335",
  borderAccent: "#3b4261",
  muted: "#565f89",
  text: "#c0caf5",
  textSecondary: "#a9b1d6",
  textMuted: "#7aa2f7",
  textDim: "#565f89",
  
  // Accents
  blue: "#7aa2f7",
  blueGlow: "rgba(122, 162, 247, 0.15)",
  cyan: "#7dcfff",
  teal: "#73daca",
  purple: "#bb9af7",
  green: "#9ece6a",
  greenGlow: "rgba(158, 206, 106, 0.18)",
  yellow: "#e0af68",
  orange: "#ff9e64",
  red: "#f7768e",
  magenta: "#bb9af7",
};

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

class SvgBuilder {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.defs = [];
    this.elements = [];
  }

  addDef(def) {
    this.defs.push(def);
  }

  add(elem) {
    this.elements.push(elem);
  }

  render() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${this.width} ${this.height}" width="100%" height="100%" style="background-color: ${THEME.bg}; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <defs>
    ${this.defs.join("\n    ")}
  </defs>
  ${this.elements.join("\n  ")}
</svg>`;
  }
}

const svg = new SvgBuilder(1600, 960);

// Setup gradients, filters, and markers
svg.addDef(`
    <!-- Arrow Markers -->
    <marker id="arrow-blue" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${THEME.blue}" />
    </marker>
    <marker id="arrow-teal" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${THEME.teal}" />
    </marker>
    <marker id="arrow-green" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${THEME.green}" />
    </marker>
    <marker id="arrow-purple" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${THEME.purple}" />
    </marker>
    <marker id="arrow-yellow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${THEME.yellow}" />
    </marker>
    <marker id="arrow-red" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${THEME.red}" />
    </marker>
    <marker id="arrow-muted" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="${THEME.muted}" />
    </marker>

    <!-- Filters -->
    <filter id="glow-panel" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.5" />
    </filter>
    <filter id="glow-primary" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="${THEME.blue}" flood-opacity="0.2" />
    </filter>
    <filter id="glow-success" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="${THEME.green}" flood-opacity="0.25" />
    </filter>
`);

// Helper: Grid background
svg.add(`
  <!-- Background Pattern -->
  <g opacity="0.04">
    <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#c0caf5" stroke-width="1" />
    </pattern>
    <rect width="1600" height="960" fill="url(#grid-pattern)" />
  </g>
`);

// Helper: Header Bar
svg.add(`
  <!-- Header Bar -->
  <g transform="translate(40, 24)">
    <rect x="0" y="0" width="1520" height="54" rx="10" fill="${THEME.panel}" stroke="${THEME.border}" stroke-width="1" />
    <circle cx="24" cy="27" r="10" fill="${THEME.purple}" opacity="0.2" />
    <circle cx="24" cy="27" r="5" fill="${THEME.purple}" />
    
    <text x="44" y="32" fill="${THEME.text}" font-size="16" font-weight="700" letter-spacing="1.5">FORGELOOP</text>
    <text x="165" y="32" fill="${THEME.muted}" font-size="14" font-weight="400">|</text>
    <text x="180" y="32" fill="${THEME.textSecondary}" font-size="13" font-weight="500">Universal Evidence-First Engineering Protocol &amp; Execution Lifecycle</text>
    
    <!-- Badges on right of header -->
    <g transform="translate(1190, 14)">
      <rect x="0" y="0" width="90" height="26" rx="13" fill="${THEME.panelSecondary}" stroke="${THEME.blue}" stroke-width="1" />
      <text x="45" y="17" fill="${THEME.blue}" font-size="11" font-weight="700" text-anchor="middle">v${escapeXml(version)}</text>

      <rect x="100" y="0" width="105" height="26" rx="13" fill="${THEME.panelSecondary}" stroke="${THEME.teal}" stroke-width="1" />
      <text x="152" y="17" fill="${THEME.teal}" font-size="11" font-weight="600" text-anchor="middle">AUTONOMOUS</text>

      <rect x="215" y="0" width="105" height="26" rx="13" fill="${THEME.panelSecondary}" stroke="${THEME.green}" stroke-width="1" />
      <text x="267" y="17" fill="${THEME.green}" font-size="11" font-weight="600" text-anchor="middle">ZERO DRIFT</text>
    </g>
  </g>
`);

// Panel Drawer Helper
function drawPanel({ x, y, width, height, title, subtitle, tag, accentColor, isCenter = false }) {
  const strokeColor = isCenter ? THEME.blue : THEME.border;
  const strokeWidth = isCenter ? "1.5" : "1";
  const filter = isCenter ? 'filter="url(#glow-primary)"' : 'filter="url(#glow-panel)"';

  return `
    <!-- Panel: ${escapeXml(title)} -->
    <g ${filter}>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="12" fill="${THEME.panel}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
      
      <!-- Panel Header Bar -->
      <path d="M ${x} ${y + 12} A 12 12 0 0 1 ${x + 12} ${y} L ${x + width - 12} ${y} A 12 12 0 0 1 ${x + width} ${y + 12} L ${x + width} ${y + 44} L ${x} ${y + 44} Z" fill="${THEME.panelHeader}" />
      <line x1="${x}" y1="${y + 44}" x2="${x + width}" y2="${y + 44}" stroke="${THEME.border}" stroke-width="1" />
      
      <circle cx="${x + 20}" cy="${y + 22}" r="4" fill="${accentColor}" />
      <text x="${x + 32}" y="${y + 26}" fill="${THEME.text}" font-size="12" font-weight="700" letter-spacing="1">${escapeXml(title)}</text>
      
      ${tag ? `
        <rect x="${x + width - tag.length * 7 - 20}" y="${y + 12}" width="${tag.length * 7 + 12}" height="20" rx="10" fill="${THEME.panelSecondary}" stroke="${accentColor}" stroke-width="0.75" />
        <text x="${x + width - (tag.length * 7 + 12) / 2 - 14}" y="${y + 26}" fill="${accentColor}" font-size="9.5" font-weight="600" text-anchor="middle">${escapeXml(tag)}</text>
      ` : ""}
    </g>
  `;
}

// Card Drawer Helper
function drawCard({ x, y, width, height, title, subtitle, meta, accent = THEME.blue, rx = 8, isHighlight = false, isSuccess = false }) {
  const bg = isHighlight ? "#1a1e30" : THEME.panelSecondary;
  const border = isSuccess ? THEME.green : isHighlight ? THEME.blue : THEME.border;
  const strokeWidth = isHighlight || isSuccess ? "1.5" : "1";
  const filter = isSuccess ? 'filter="url(#glow-success)"' : isHighlight ? 'filter="url(#glow-primary)"' : "";

  return `
    <g ${filter}>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${rx}" fill="${bg}" stroke="${border}" stroke-width="${strokeWidth}" />
      <rect x="${x}" y="${y}" width="4" height="${height}" rx="2" fill="${accent}" />
      
      <text x="${x + 16}" y="${y + 20}" fill="${THEME.text}" font-size="12" font-weight="600">${escapeXml(title)}</text>
      ${subtitle ? `<text x="${x + 16}" y="${y + 36}" fill="${THEME.textSecondary}" font-size="10.5" font-weight="400">${escapeXml(subtitle)}</text>` : ""}
      ${meta ? `<text x="${x + 16}" y="${y + (subtitle ? 50 : 36)}" fill="${THEME.muted}" font-size="9.5" font-mono="true">${escapeXml(meta)}</text>` : ""}
    </g>
  `;
}

// Badge Drawer Helper
function drawBadge({ x, y, text, color, bg = THEME.panelSecondary, width = 80 }) {
  return `
    <g>
      <rect x="${x}" y="${y}" width="${width}" height="22" rx="6" fill="${bg}" stroke="${color}" stroke-width="1" />
      <text x="${x + width / 2}" y="${y + 15}" fill="${color}" font-size="10" font-weight="600" text-anchor="middle">${escapeXml(text)}</text>
    </g>
  `;
}

// ==========================================
// REGION 1: BOOTSTRAP & ADAPTATION
// ==========================================
svg.add(drawPanel({
  x: 40,
  y: 95,
  width: 320,
  height: 645,
  title: "1. BOOTSTRAP & ADAPTERS",
  tag: "NATIVE SHIMS",
  accentColor: THEME.cyan,
}));

// Region 1 Cards
svg.add(drawCard({
  x: 58,
  y: 155,
  width: 284,
  height: 60,
  title: "Universal Discovery & Adapters",
  subtitle: "Capability-based integration · Vendor-neutral",
  meta: "AGENTS.md · CLAUDE.md · PROTOCOL_INTEGRATION.md",
  accent: THEME.cyan,
}));

svg.add(drawCard({
  x: 58,
  y: 235,
  width: 284,
  height: 60,
  title: "Target Kit Layout v2",
  subtitle: "Hidden kit isolation & authority manifest",
  meta: ".forgeloop/kit/ + .forgeloop/manifest.json",
  accent: THEME.teal,
}));

// Migration Track Inner Panel
svg.add(`
  <g transform="translate(58, 315)">
    <rect x="0" y="0" width="284" height="280" rx="8" fill="#131520" stroke="${THEME.border}" stroke-width="1" stroke-dasharray="3 3" />
    <text x="14" y="22" fill="${THEME.purple}" font-size="10.5" font-weight="700" letter-spacing="0.5">LEGACY MIGRATION &amp; RECOVERY</text>
    <text x="14" y="38" fill="${THEME.muted}" font-size="9.5">Automatic upgrade from v1 layout to v2</text>
    
    <!-- Step 1 -->
    <circle cx="20" cy="62" r="7" fill="${THEME.panelSecondary}" stroke="${THEME.teal}" stroke-width="1" />
    <text x="20" y="65.5" fill="${THEME.teal}" font-size="9" font-weight="700" text-anchor="middle">1</text>
    <text x="34" y="65.5" fill="${THEME.textSecondary}" font-size="10">Validate paths &amp; build plan</text>

    <!-- Step 2 -->
    <circle cx="20" cy="94" r="7" fill="${THEME.panelSecondary}" stroke="${THEME.teal}" stroke-width="1" />
    <text x="20" y="97.5" fill="${THEME.teal}" font-size="9" font-weight="700" text-anchor="middle">2</text>
    <text x="34" y="97.5" fill="${THEME.textSecondary}" font-size="10">Write hidden kit &amp; verify bytes</text>

    <!-- Step 3 -->
    <circle cx="20" cy="126" r="7" fill="${THEME.panelSecondary}" stroke="${THEME.teal}" stroke-width="1" />
    <text x="20" y="129.5" fill="${THEME.teal}" font-size="9" font-weight="700" text-anchor="middle">3</text>
    <text x="34" y="129.5" fill="${THEME.textSecondary}" font-size="10">Atomic manifest authority switch</text>

    <!-- Step 4 -->
    <circle cx="20" cy="158" r="7" fill="${THEME.panelSecondary}" stroke="${THEME.teal}" stroke-width="1" />
    <text x="20" y="161.5" fill="${THEME.teal}" font-size="9" font-weight="700" text-anchor="middle">4</text>
    <text x="34" y="161.5" fill="${THEME.textSecondary}" font-size="10">Hash-checked legacy cleanup</text>

    <!-- Interruption fallback -->
    <rect x="14" y="184" width="256" height="52" rx="6" fill="#1e1520" stroke="${THEME.red}" stroke-width="0.75" />
    <text x="24" y="202" fill="${THEME.red}" font-size="10" font-weight="600">Interruption Safeguard</text>
    <text x="24" y="218" fill="${THEME.textSecondary}" font-size="9">E_MIGRATION_INCOMPLETE → doctor / update</text>
    <text x="24" y="230" fill="${THEME.muted}" font-size="8.5">Safe TOCTOU recovery without data loss</text>

    <!-- Connectors inside migration track -->
    <line x1="20" y1="70" x2="20" y2="86" stroke="${THEME.border}" stroke-width="1.5" />
    <line x1="20" y1="102" x2="20" y2="118" stroke="${THEME.border}" stroke-width="1.5" />
    <line x1="20" y1="134" x2="20" y2="150" stroke="${THEME.border}" stroke-width="1.5" />
    <line x1="20" y1="166" x2="20" y2="182" stroke="${THEME.muted}" stroke-width="1" stroke-dasharray="2 2" />
  </g>
`);

svg.add(drawCard({
  x: 58,
  y: 615,
  width: 284,
  height: 56,
  title: "Target Project Initialized",
  subtitle: "Ready for discovery & fact gathering",
  meta: "forgeloop init · forgeloop doctor",
  accent: THEME.teal,
}));

// Connectors in Region 1
svg.add(`
  <path d="M 200 215 L 200 235" stroke="${THEME.muted}" stroke-width="1.5" marker-end="url(#arrow-muted)" />
  <path d="M 200 295 L 200 315" stroke="${THEME.muted}" stroke-width="1.5" marker-end="url(#arrow-muted)" />
  <path d="M 200 595 L 200 615" stroke="${THEME.teal}" stroke-width="1.5" marker-end="url(#arrow-teal)" />
`);

// ==========================================
// REGION 2: DISCOVERY, CONTRACT & ROUTING
// ==========================================
svg.add(drawPanel({
  x: 380,
  y: 95,
  width: 350,
  height: 645,
  title: "2. DISCOVERY & CONTRACT",
  tag: "PREFLIGHT GATES",
  accentColor: THEME.purple,
}));

svg.add(drawCard({
  x: 400,
  y: 155,
  width: 310,
  height: 60,
  title: "Project Profile Discovery",
  subtitle: "Strictly verifiable project facts & registry",
  meta: ".forgeloop/kit/PROJECT_PROFILE.md",
  accent: THEME.purple,
}));

svg.add(drawCard({
  x: 400,
  y: 235,
  width: 310,
  height: 64,
  title: "Current Contract",
  subtitle: "Success criteria, assumptions & decisions",
  meta: ".forgeloop/current-contract.json",
  accent: THEME.purple,
}));

svg.add(drawCard({
  x: 400,
  y: 320,
  width: 310,
  height: 64,
  title: "Deterministic Route",
  subtitle: "Contextual guide selection from router",
  meta: "GUIDE_ROUTER.md → routing-result.json",
  accent: THEME.blue,
}));

svg.add(drawCard({
  x: 400,
  y: 405,
  width: 310,
  height: 60,
  title: "Required Gates",
  subtitle: "Risk-proportional design & policy gates",
  meta: ".forgeloop/gates/*.json (plan, review, sec)",
  accent: THEME.yellow,
}));

svg.add(drawCard({
  x: 400,
  y: 485,
  width: 310,
  height: 64,
  title: "Preflight Reconciliation",
  subtitle: "Reconciles contract, route & mandatory gates",
  meta: "forgeloop preflight",
  accent: THEME.blue,
}));

// Preflight Decisions / Outcome
svg.add(`
  <!-- Preflight Outcomes -->
  <g transform="translate(400, 570)">
    <!-- READY Path -->
    <rect x="0" y="0" width="195" height="100" rx="8" fill="#132320" stroke="${THEME.green}" stroke-width="1.5" filter="url(#glow-success)" />
    <circle cx="16" cy="18" r="5" fill="${THEME.green}" />
    <text x="28" y="22" fill="${THEME.green}" font-size="11.5" font-weight="700">PREFLIGHT_READY</text>
    <text x="14" y="42" fill="${THEME.text}" font-size="10">Resumable checkpoint created</text>
    <text x="14" y="58" fill="${THEME.textSecondary}" font-size="9">Activation chronology logged</text>
    <text x="14" y="74" fill="${THEME.teal}" font-size="8.5">Event ledger hash-chain init</text>
    <text x="14" y="90" fill="${THEME.green}" font-size="9" font-mono="true">READY → Authorizes Exec</text>

    <!-- BLOCKED Path -->
    <rect x="205" y="0" width="105" height="100" rx="8" fill="#23151b" stroke="${THEME.red}" stroke-width="1" />
    <circle cx="219" cy="18" r="4" fill="${THEME.red}" />
    <text x="229" y="22" fill="${THEME.red}" font-size="11" font-weight="700">BLOCKED</text>
    <text x="215" y="42" fill="${THEME.textSecondary}" font-size="9">Gate missing or</text>
    <text x="215" y="56" fill="${THEME.textSecondary}" font-size="9">unresolved</text>
    <text x="215" y="70" fill="${THEME.textSecondary}" font-size="9">decision</text>
    <text x="215" y="90" fill="${THEME.red}" font-size="8.5">Requires repair</text>
  </g>
`);

// Connectors in Region 2
svg.add(`
  <path d="M 342 643 L 400 185" stroke="${THEME.cyan}" stroke-width="1.5" marker-end="url(#arrow-teal)" />
  <path d="M 555 215 L 555 235" stroke="${THEME.purple}" stroke-width="1.5" marker-end="url(#arrow-purple)" />
  <path d="M 555 299 L 555 320" stroke="${THEME.purple}" stroke-width="1.5" marker-end="url(#arrow-purple)" />
  <path d="M 555 384 L 555 405" stroke="${THEME.blue}" stroke-width="1.5" marker-end="url(#arrow-blue)" />
  <path d="M 555 465 L 555 485" stroke="${THEME.yellow}" stroke-width="1.5" marker-end="url(#arrow-yellow)" />
  <path d="M 555 549 L 555 560 L 497 560 L 497 570" stroke="${THEME.green}" stroke-width="1.5" marker-end="url(#arrow-green)" />
  <path d="M 555 549 L 555 560 L 657 560 L 657 570" stroke="${THEME.red}" stroke-width="1.5" stroke-dasharray="2 2" marker-end="url(#arrow-red)" />
`);

// ==========================================
// REGION 3: EXECUTION & VERIFICATION LOOP
// ==========================================
svg.add(drawPanel({
  x: 750,
  y: 95,
  width: 480,
  height: 645,
  title: "3. EXECUTION & VERIFICATION LOOP",
  tag: "CANONICAL CORE",
  accentColor: THEME.blue,
  isCenter: true,
}));

// Work-State & Ledger Row
svg.add(drawCard({
  x: 770,
  y: 155,
  width: 440,
  height: 58,
  title: "Resumable Work-State &amp; Event Ledger",
  subtitle: "Atomic work-state.json + hash-chained events.ndjson",
  meta: "Phase tracked · Verification cycle counter · Zero secret leakage",
  accent: THEME.blue,
  isHighlight: true,
}));

// Execution Lifecycle Horizontal Step Bar
svg.add(`
  <g transform="translate(770, 225)">
    <rect x="0" y="0" width="440" height="60" rx="8" fill="${THEME.panelSecondary}" stroke="${THEME.border}" stroke-width="1" />
    
    <!-- Step 1: PLANNED -->
    <rect x="10" y="10" width="125" height="40" rx="6" fill="#1f2335" stroke="${THEME.blue}" stroke-width="1" />
    <text x="72" y="27" fill="${THEME.blue}" font-size="10.5" font-weight="700" text-anchor="middle">PLANNED</text>
    <text x="72" y="42" fill="${THEME.muted}" font-size="8.5" text-anchor="middle">Task scoped</text>
    
    <path d="M 137 30 L 157 30" stroke="${THEME.muted}" stroke-width="1.5" marker-end="url(#arrow-muted)" />

    <!-- Step 2: EXECUTING -->
    <rect x="160" y="10" width="125" height="40" rx="6" fill="#1f2335" stroke="${THEME.cyan}" stroke-width="1" />
    <text x="222" y="27" fill="${THEME.cyan}" font-size="10.5" font-weight="700" text-anchor="middle">EXECUTING</text>
    <text x="222" y="42" fill="${THEME.muted}" font-size="8.5" text-anchor="middle">Implementation</text>
    
    <path d="M 287 30 L 307 30" stroke="${THEME.muted}" stroke-width="1.5" marker-end="url(#arrow-muted)" />

    <!-- Step 3: VERIFYING -->
    <rect x="310" y="10" width="120" height="40" rx="6" fill="#1a2536" stroke="${THEME.teal}" stroke-width="1.5" />
    <text x="370" y="27" fill="${THEME.teal}" font-size="10.5" font-weight="700" text-anchor="middle">VERIFYING</text>
    <text x="370" y="42" fill="${THEME.textSecondary}" font-size="8.5" text-anchor="middle">Cycle N verification</text>
  </g>
`);

// Prepare & Checks Block
svg.add(drawCard({
  x: 770,
  y: 298,
  width: 440,
  height: 60,
  title: "Prepare Completion &amp; Record Checks",
  subtitle: "Captures observed commands & structured evidence items",
  meta: "forgeloop prepare-completion · forgeloop record-check",
  accent: THEME.teal,
}));

// Evidence Readiness Decision Gate
svg.add(`
  <g transform="translate(770, 372)">
    <rect x="0" y="0" width="440" height="66" rx="8" fill="#181d30" stroke="${THEME.blue}" stroke-width="1.5" />
    <circle cx="20" cy="33" r="6" fill="${THEME.blue}" />
    <text x="34" y="26" fill="${THEME.blue}" font-size="12" font-weight="700">CANONICAL EVIDENCE READINESS</text>
    <text x="34" y="42" fill="${THEME.textSecondary}" font-size="10">Are all contract requirements covered by valid evidence in cycle N?</text>
    <text x="34" y="56" fill="${THEME.muted}" font-size="8.5">Rejects premature claims, future-lifecycle leakage, and mixed criteria</text>
  </g>
`);

// Branching Row: Diagnosis vs Review
// Left: Diagnosing & Correcting Loop (Red/Yellow)
svg.add(`
  <g transform="translate(770, 452)">
    <rect x="0" y="0" width="205" height="88" rx="8" fill="#201a24" stroke="${THEME.yellow}" stroke-width="1" />
    <text x="14" y="20" fill="${THEME.yellow}" font-size="11" font-weight="700">DIAGNOSE &amp; CORRECT</text>
    <text x="14" y="36" fill="${THEME.textSecondary}" font-size="9.5">Check failed or blocked</text>
    <text x="14" y="50" fill="${THEME.muted}" font-size="8.5">Advance: DIAGNOSING</text>
    <text x="14" y="64" fill="${THEME.muted}" font-size="8.5">Formulate fix hypothesis</text>
    <text x="14" y="78" fill="${THEME.yellow}" font-size="8.5">CORRECTING → loop to VERIFY</text>
  </g>
`);

// Right: Reviewing & Terminal Results (Teal/Green)
svg.add(`
  <g transform="translate(990, 452)">
    <rect x="0" y="0" width="220" height="88" rx="8" fill="#132326" stroke="${THEME.teal}" stroke-width="1.5" />
    <text x="14" y="20" fill="${THEME.teal}" font-size="11" font-weight="700">REVIEWING (CYCLE N)</text>
    <text x="14" y="36" fill="${THEME.textSecondary}" font-size="9.5">Evidence complete &amp; verified</text>
    <text x="14" y="50" fill="${THEME.muted}" font-size="8.5">Advance: REVIEWING</text>
    <text x="14" y="64" fill="${THEME.muted}" font-size="8.5">Cross-checks criteria &amp; gates</text>
    <text x="14" y="78" fill="${THEME.teal}" font-size="8.5">Ready for terminal completion</text>
  </g>
`);

// Record Terminal Result Card
svg.add(drawCard({
  x: 770,
  y: 554,
  width: 440,
  height: 60,
  title: "Record Terminal Result (External Criteria)",
  subtitle: "Exact requirementId matching for PUBLICATION &amp; PRODUCTION",
  meta: "forgeloop record-terminal-result --requirement=... --status=...",
  accent: THEME.purple,
}));

// Complete Command Card & Rejection Loop
svg.add(drawCard({
  x: 770,
  y: 626,
  width: 440,
  height: 52,
  title: "Complete Validation &amp; Rejection Recovery",
  subtitle: "forgeloop complete → VALID (Terminal) or REJECTED (Cycle N+1)",
  meta: "Evidence-only rejection appends COMPLETION_REJECTED event and resets to VERIFYING",
  accent: THEME.green,
}));

// Connectors in Region 3
svg.add(`
  <!-- PREFLIGHT_READY into Work State -->
  <path d="M 595 620 C 680 620, 720 184, 770 184" fill="none" stroke="${THEME.green}" stroke-width="1.5" marker-end="url(#arrow-green)" />

  <!-- Work State to Lifecycle -->
  <path d="M 990 213 L 990 225" stroke="${THEME.blue}" stroke-width="1.5" marker-end="url(#arrow-blue)" />

  <!-- Lifecycle to Prepare Checks -->
  <path d="M 990 285 L 990 298" stroke="${THEME.teal}" stroke-width="1.5" marker-end="url(#arrow-teal)" />

  <!-- Checks to Evidence Readiness -->
  <path d="M 990 358 L 990 372" stroke="${THEME.teal}" stroke-width="1.5" marker-end="url(#arrow-teal)" />

  <!-- Evidence Readiness to Diagnose (Fail) -->
  <path d="M 870 438 L 870 452" stroke="${THEME.yellow}" stroke-width="1.5" marker-end="url(#arrow-yellow)" />
  
  <!-- Diagnose loop back to Verifying -->
  <path d="M 770 496 C 730 496, 730 255, 768 255" fill="none" stroke="${THEME.yellow}" stroke-width="1.5" stroke-dasharray="3 3" marker-end="url(#arrow-yellow)" />

  <!-- Evidence Readiness to Reviewing (Covered) -->
  <path d="M 1100 438 L 1100 452" stroke="${THEME.teal}" stroke-width="1.5" marker-end="url(#arrow-teal)" />

  <!-- Reviewing to Terminal Result -->
  <path d="M 1100 540 L 1100 554" stroke="${THEME.purple}" stroke-width="1.5" marker-end="url(#arrow-purple)" />

  <!-- Terminal Result to Complete -->
  <path d="M 990 614 L 990 626" stroke="${THEME.green}" stroke-width="1.5" marker-end="url(#arrow-green)" />

  <!-- Completion Rejected Recovery loop back to VERIFYING (Cycle N + 1) -->
  <path d="M 770 652 C 715 652, 715 328, 768 328" fill="none" stroke="${THEME.red}" stroke-width="1.5" stroke-dasharray="3 3" marker-end="url(#arrow-red)" />
`);

// ==========================================
// REGION 4: CONFORMANCE, RECEIPT & AUDIT
// ==========================================
svg.add(drawPanel({
  x: 1250,
  y: 95,
  width: 310,
  height: 645,
  title: "4. RECEIPT & AUDIT",
  tag: "CONFORMANCE",
  accentColor: THEME.green,
}));

svg.add(drawCard({
  x: 1270,
  y: 155,
  width: 270,
  height: 60,
  title: "Execution Receipt",
  subtitle: "Durable verifiable proof of execution",
  meta: ".forgeloop/execution-receipt.json",
  accent: THEME.green,
}));

svg.add(drawCard({
  x: 1270,
  y: 230,
  width: 270,
  height: 64,
  title: "Protocol Conformance",
  subtitle: "Cross-artifact cryptographic check",
  meta: "forgeloop validate-protocol --json",
  accent: THEME.blue,
}));

// Conformance Verdicts Panel
svg.add(`
  <g transform="translate(1270, 308)">
    <rect x="0" y="0" width="270" height="210" rx="8" fill="#121624" stroke="${THEME.border}" stroke-width="1" />
    <text x="14" y="22" fill="${THEME.text}" font-size="11" font-weight="700" letter-spacing="0.5">VALIDATE-PROTOCOL VERDICTS</text>
    
    <!-- VALID -->
    <rect x="14" y="34" width="60" height="20" rx="4" fill="#13261c" stroke="${THEME.green}" stroke-width="1" />
    <text x="44" y="48" fill="${THEME.green}" font-size="9.5" font-weight="700" text-anchor="middle">VALID</text>
    <text x="82" y="48" fill="${THEME.textSecondary}" font-size="9">All artifacts match &amp; complete</text>

    <!-- STALE -->
    <rect x="14" y="62" width="60" height="20" rx="4" fill="#262213" stroke="${THEME.yellow}" stroke-width="1" />
    <text x="44" y="76" fill="${THEME.yellow}" font-size="9.5" font-weight="700" text-anchor="middle">STALE</text>
    <text x="82" y="76" fill="${THEME.textSecondary}" font-size="9">Contract or Git HEAD changed</text>

    <!-- INCOMPLETE -->
    <rect x="14" y="90" width="60" height="20" rx="4" fill="#261b13" stroke="${THEME.orange}" stroke-width="1" />
    <text x="44" y="104" fill="${THEME.orange}" font-size="8.5" font-weight="700" text-anchor="middle">INCOMPL</text>
    <text x="82" y="104" fill="${THEME.textSecondary}" font-size="9">Missing required artifacts</text>

    <!-- INCONSISTENT -->
    <rect x="14" y="118" width="60" height="20" rx="4" fill="#241326" stroke="${THEME.magenta}" stroke-width="1" />
    <text x="44" y="132" fill="${THEME.magenta}" font-size="8.5" font-weight="700" text-anchor="middle">INCONSIST</text>
    <text x="82" y="132" fill="${THEME.textSecondary}" font-size="9">Fingerprint / ledger mismatch</text>

    <!-- INVALID -->
    <rect x="14" y="146" width="60" height="20" rx="4" fill="#261317" stroke="${THEME.red}" stroke-width="1" />
    <text x="44" y="160" fill="${THEME.red}" font-size="9.5" font-weight="700" text-anchor="middle">INVALID</text>
    <text x="82" y="160" fill="${THEME.textSecondary}" font-size="9">Corrupted schema or secret found</text>

    <line x1="14" y1="176" x2="256" y2="176" stroke="${THEME.border}" stroke-width="1" />
    <text x="14" y="196" fill="${THEME.muted}" font-size="9">Precedence: INVALID &gt; STALE &gt; VALID</text>
  </g>
`);

// Terminal Outcome Box (COMPLETE)
svg.add(`
  <g transform="translate(1270, 532)">
    <rect x="0" y="0" width="270" height="66" rx="8" fill="#132b20" stroke="${THEME.green}" stroke-width="2" filter="url(#glow-success)" />
    <circle cx="20" cy="33" r="6" fill="${THEME.green}" />
    <text x="34" y="27" fill="${THEME.green}" font-size="13" font-weight="800" letter-spacing="1">COMPLETE STATE</text>
    <text x="34" y="44" fill="${THEME.text}" font-size="10.5" font-weight="500">Validator-Backed Protocol Closure</text>
    <text x="34" y="58" fill="${THEME.teal}" font-size="9">forgeloop complete → VALID</text>
  </g>
`);

svg.add(drawCard({
  x: 1270,
  y: 612,
  width: 270,
  height: 60,
  title: "Audit &amp; Inspection CLI",
  subtitle: "Full lifecycle provenance verification",
  meta: "forgeloop audit --json · forgeloop status",
  accent: THEME.teal,
}));

// Connectors to Region 4
svg.add(`
  <path d="M 1210 652 L 1270 565" stroke="${THEME.green}" stroke-width="2" marker-end="url(#arrow-green)" />
  <path d="M 1405 215 L 1405 230" stroke="${THEME.green}" stroke-width="1.5" marker-end="url(#arrow-green)" />
  <path d="M 1405 294 L 1405 308" stroke="${THEME.blue}" stroke-width="1.5" marker-end="url(#arrow-blue)" />
  <path d="M 1405 598 L 1405 612" stroke="${THEME.teal}" stroke-width="1.5" marker-end="url(#arrow-teal)" />
`);

// ==========================================
// BOTTOM LANES: FRESHNESS & DELEGATION
// ==========================================

// Bottom Lane 1: Freshness & Cryptographic Provenance
svg.add(`
  <!-- Panel: Freshness & Cryptographic Provenance -->
  <g filter="url(#glow-panel)">
    <rect x="40" y="755" width="690" height="175" rx="10" fill="${THEME.panel}" stroke="${THEME.border}" stroke-width="1" />
    
    <!-- Header Bar -->
    <path d="M 40 765 A 10 10 0 0 1 50 755 L 720 755 A 10 10 0 0 1 730 765 L 730 791 L 40 791 Z" fill="${THEME.panelHeader}" />
    <line x1="40" y1="791" x2="730" y2="791" stroke="${THEME.border}" stroke-width="1" />
    
    <circle cx="58" cy="773" r="4" fill="${THEME.blue}" />
    <text x="70" y="777" fill="${THEME.text}" font-size="11.5" font-weight="700" letter-spacing="1">FRESHNESS &amp; CRYPTOGRAPHIC FINGERPRINTING</text>
    
    <text x="58" y="811" fill="${THEME.textSecondary}" font-size="10.5">Deterministic cross-artifact hashing prevents silent drift and stale state execution</text>

    <!-- Card 1: Contract Fingerprint -->
    <rect x="58" y="823" width="210" height="46" rx="6" fill="${THEME.panelSecondary}" stroke="${THEME.border}" stroke-width="1" />
    <rect x="58" y="823" width="3" height="46" rx="1.5" fill="${THEME.blue}" />
    <text x="70" y="841" fill="${THEME.blue}" font-size="10" font-weight="700">Contract Fingerprint</text>
    <text x="70" y="857" fill="${THEME.muted}" font-size="9" font-family="monospace">SHA-256 (key-order invariant)</text>

    <!-- Card 2: Repository Fingerprint -->
    <rect x="280" y="823" width="210" height="46" rx="6" fill="${THEME.panelSecondary}" stroke="${THEME.border}" stroke-width="1" />
    <rect x="280" y="823" width="3" height="46" rx="1.5" fill="${THEME.purple}" />
    <text x="292" y="841" fill="${THEME.purple}" font-size="10" font-weight="700">Repository Fingerprint</text>
    <text x="292" y="857" fill="${THEME.muted}" font-size="9" font-family="monospace">Git branch + HEAD commit SHA</text>

    <!-- Card 3: Ledger Hash Chain -->
    <rect x="502" y="823" width="210" height="46" rx="6" fill="${THEME.panelSecondary}" stroke="${THEME.border}" stroke-width="1" />
    <rect x="502" y="823" width="3" height="46" rx="1.5" fill="${THEME.teal}" />
    <text x="514" y="841" fill="${THEME.teal}" font-size="10" font-weight="700">Ledger Hash Chain</text>
    <text x="514" y="857" fill="${THEME.muted}" font-size="9" font-family="monospace">Append-only SHA-256 chain</text>

    <!-- Bottom summary banner -->
    <rect x="58" y="881" width="654" height="34" rx="6" fill="#121826" stroke="${THEME.blue}" stroke-width="0.75" />
    <text x="72" y="902" fill="${THEME.textSecondary}" font-size="10">Revalidation Trigger: Changed Contract · Changed Git HEAD · Missing Required Artifacts → <tspan fill="${THEME.yellow}" font-weight="700">REVALIDATION_REQUIRED</tspan></text>
  </g>
`);

// Bottom Lane 2: Delegation & Compatible Harness Handoff
svg.add(`
  <!-- Panel: Delegation & Compatible Harness Handoff -->
  <g filter="url(#glow-panel)">
    <rect x="750" y="755" width="810" height="175" rx="10" fill="${THEME.panel}" stroke="${THEME.border}" stroke-width="1" />
    
    <!-- Header Bar -->
    <path d="M 750 765 A 10 10 0 0 1 760 755 L 1550 755 A 10 10 0 0 1 1560 765 L 1560 791 L 750 791 Z" fill="${THEME.panelHeader}" />
    <line x1="750" y1="791" x2="1560" y2="791" stroke="${THEME.border}" stroke-width="1" />
    
    <circle cx="768" cy="773" r="4" fill="${THEME.teal}" />
    <text x="780" y="777" fill="${THEME.text}" font-size="11.5" font-weight="700" letter-spacing="1">DELEGATION &amp; COMPATIBLE HARNESS HANDOFF</text>
    
    <!-- Key distinction badge -->
    <rect x="1240" y="763" width="310" height="20" rx="10" fill="#132326" stroke="${THEME.teal}" stroke-width="0.75" />
    <text x="1395" y="777" fill="${THEME.teal}" font-size="9.5" font-weight="600" text-anchor="middle">ForgeLoop is a protocol, not an agent runtime</text>

    <text x="768" y="811" fill="${THEME.textSecondary}" font-size="10.5">Structured multi-agent delegation bundles with explicit scope, required artifacts &amp; contract assumptions</text>

    <!-- Card 1: Task Brief -->
    <rect x="768" y="823" width="250" height="46" rx="6" fill="${THEME.panelSecondary}" stroke="${THEME.border}" stroke-width="1" />
    <rect x="768" y="823" width="3" height="46" rx="1.5" fill="${THEME.cyan}" />
    <text x="780" y="841" fill="${THEME.cyan}" font-size="10" font-weight="700">Task Brief Schema</text>
    <text x="780" y="857" fill="${THEME.muted}" font-size="9" font-family="monospace">task-brief.schema.json</text>

    <!-- Card 2: Task Bundle -->
    <rect x="1030" y="823" width="250" height="46" rx="6" fill="${THEME.panelSecondary}" stroke="${THEME.border}" stroke-width="1" />
    <rect x="1030" y="823" width="3" height="46" rx="1.5" fill="${THEME.teal}" />
    <text x="1042" y="841" fill="${THEME.teal}" font-size="10" font-weight="700">Task Bundle Manifest</text>
    <text x="1042" y="857" fill="${THEME.muted}" font-size="9" font-family="monospace">task-bundle.schema.json</text>

    <!-- Card 3: Delegated Result -->
    <rect x="1292" y="823" width="250" height="46" rx="6" fill="${THEME.panelSecondary}" stroke="${THEME.border}" stroke-width="1" />
    <rect x="1292" y="823" width="3" height="46" rx="1.5" fill="${THEME.purple}" />
    <text x="1304" y="841" fill="${THEME.purple}" font-size="10" font-weight="700">Delegated Result Receipt</text>
    <text x="1304" y="857" fill="${THEME.muted}" font-size="9" font-family="monospace">delegated-result.schema.json</text>

    <!-- Compatible Agent Ecosystem Footer -->
    <rect x="768" y="881" width="774" height="34" rx="6" fill="#161c28" stroke="${THEME.cyan}" stroke-width="0.75" />
    <text x="782" y="902" fill="${THEME.textSecondary}" font-size="10">Universal Integration: <tspan fill="${THEME.cyan}" font-weight="600">Codex · Claude Code · Cursor · Copilot · Antigravity · OpenCode · Hermes · Pi · Custom AI Agents &amp; Devs</tspan></text>
  </g>
`);

// Write the SVG file
const svgContent = svg.render();
fs.mkdirSync(path.dirname(outputSvgPath), { recursive: true });
fs.writeFileSync(outputSvgPath, svgContent, "utf8");

console.log(`Successfully generated ForgeLoop flow SVG (v${version}) at:`);
console.log(outputSvgPath);
