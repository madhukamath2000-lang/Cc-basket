# Pulse — Architectural Decision Record (ADR)

Each entry documents a decision that shaped the architecture. These are captured so a future engineer or AI assistant understands not just what the system is, but why it became that way — and what would need to change if the constraints shift.

---

## Index

| ADR | Title |
|-----|-------|
| [ADR-000](#adr-000-project-philosophy) | Project Philosophy |
| [ADR-001](#adr-001-plain-htmlcssjs--no-frontend-framework) | Plain HTML/CSS/JS — No Frontend Framework |
| [ADR-002](#adr-002-cloudflare-pages--no-dedicated-backend-server) | Cloudflare Pages — No Dedicated Backend Server |
| [ADR-003](#adr-003-cloudflare-pages-functions--not-a-separate-worker-service) | Cloudflare Pages Functions — Not a Separate Worker Service |
| [ADR-004](#adr-004-single-file-spa-indexhtml) | Single-File SPA (`index.html`) |
| [ADR-005](#adr-005-no-build-step) | No Build Step |
| [ADR-006](#adr-006-client-side-pin-gate-with-sha-256) | Client-Side PIN Gate with SHA-256 |
| [ADR-007](#adr-007-aes-256-gcm-client-side-encryption-of-the-upstox-token) | AES-256-GCM Client-Side Encryption of the Upstox Token |
| [ADR-008](#adr-008-localstorage-for-all-persistence--no-database) | `localStorage` for All Persistence — No Database |
| [ADR-009](#adr-009-the-pulse_-localstorage-key-prefix) | The `pulse_` localStorage Key Prefix |
| [ADR-010](#adr-010-_v3-versioning-suffix-on-localstorage-keys) | `_v3` Versioning Suffix on LocalStorage Keys |
| [ADR-011](#adr-011-three-tier-ltp-fallback--upstox--nse--manual) | Three-Tier LTP Fallback — Upstox → NSE → Manual |
| [ADR-012](#adr-012-upstox-token-transmitted-as-http-header-not-url-param-or-request-body) | Upstox Token Transmitted as HTTP Header |
| [ADR-013](#adr-013-cc-positions-hardcoded-in-indexhtml-not-config-driven) | CC Positions Hardcoded in `index.html` |
| [ADR-014](#adr-014-upstox-underlyings-map-hardcoded-in-the-function) | Upstox `UNDERLYINGS` Map Hardcoded in the Function |
| [ADR-015](#adr-015-plive-flag-reset-at-every-loadcc-call) | `p.live` Flag Reset at Every `loadCC()` Call |
| [ADR-016](#adr-016-sequential-nse-fetches-with-350ms-inter-request-delay) | Sequential NSE Fetches with 350ms Inter-Request Delay |
| [ADR-017](#adr-017-public-cache-control-on-cloudflare-edge-for-api-responses) | `public` Cache-Control on Cloudflare Edge for API Responses |
| [ADR-018](#adr-018-anthropic-claude-api-for-ai-briefing--optional-not-required) | Anthropic Claude API for AI Briefing — Optional, Not Required |

---

## ADR-000: Project Philosophy

**Decision:** Pulse will be governed by the following enduring principles. Every subsequent architectural decision must be consistent with them. When a proposed change conflicts with these principles, the conflict must be made explicit and the principles must be the default winner unless a compelling case is made to the contrary.

**Context:** Pulse is a long-term personal decision-support platform. The objective is not to maximise features but to build a trustworthy, maintainable, and production-ready system whose behaviour remains understandable over time. The codebase will be touched infrequently — sometimes weeks or months apart — by a single engineer or an AI assistant with no prior session context. Under these conditions, architectural clarity and documented intent are more valuable than feature density.

**The principles:**

1. **Reliability over feature count.** A dashboard that is always correct and always loads is more valuable than one with more features that sometimes fails silently.

2. **Simplicity over unnecessary complexity.** Every abstraction, dependency, and indirection has a carrying cost. Add them only when they eliminate a real problem, not a hypothetical one.

3. **Evidence over assumptions.** Do not guess at what an API returns, what a library does, or what the user wants. Read the source, check the response, ask the user.

4. **Transparency over hidden automation.** The system should behave predictably. Automated behaviour that the user cannot observe or override is a liability in a personal finance tool.

5. **Documentation as part of the product.** An undocumented system is a system that cannot be safely maintained. READMEs, ADRs, changelogs, and test plans are first-class deliverables, not afterthoughts.

6. **Small, incremental improvements over large rewrites.** A working system with known limitations is better than a rewrite with unknown ones. Improve incrementally; rewrite only when incremental improvement is demonstrably blocked.

7. **Root-cause fixes rather than symptom patches.** Understand why something is broken before deciding how to fix it. A patch that hides a symptom creates the next incident.

8. **Production stability before new features.** The existing surface must work correctly and reliably before new capabilities are added. Features do not compensate for unreliable foundations.

9. **Security and privacy by default.** Sensitive data (tokens, positions, portfolio values) must be protected at rest and in transit by default. Security must not be opt-in or left as a follow-up task.

10. **Every significant architectural decision should be documented before it is forgotten.** If a decision required thought, the thought belongs in this file so the next engineer does not have to reconstruct it.

**Consequences:**

*Benefits:*
- Consistent engineering decisions across sessions and contributors.
- Easier onboarding for future engineers and AI assistants who can read intent, not just code.
- Reduced technical debt through disciplined scope control.
- Better long-term maintainability through explicit trade-off awareness.
- Architectural continuity across intermittent development cycles.

*Trade-offs:*
- Slower feature development — discipline before implementation takes time.
- More documentation — this is a feature, not overhead.
- Higher discipline required before implementation — changes must be justified, not just attempted.

**Date:** 2026-07-04

**Future review criteria:** Review only if the overall purpose of Pulse fundamentally changes — for example, if it becomes a multi-user product, a commercial service, or is handed to a different engineering team with different constraints. The principles themselves are not version-specific; the application of them to specific decisions is.

---

## ADR-001: Plain HTML/CSS/JS — No Frontend Framework

**Decision:** The entire frontend is written in vanilla HTML5, CSS3, and ES2020+ JavaScript. No React, Vue, Angular, Svelte, or any other UI framework is used.

**Context:** Pulse is a personal dashboard for one user, one family. It will never have team features, user-generated content, or dynamic routing beyond tab switching. The UI surface area is fixed and well-understood.

**Alternatives considered:**
- **React (Next.js or Vite):** Would add a build pipeline, node_modules, JSX transpilation, and a substantial dependency tree. The benefits (component reuse, virtual DOM, ecosystem) are all irrelevant at this scale.
- **Vue (Nuxt):** Same reasoning. Adds complexity with no return.
- **Svelte:** Closer to the metal, but still requires a build step.
- **Web Components:** Technically zero-dependency, but verbose and poorly supported on older mobile browsers.

**Why this approach:** A personal wealth dashboard with 7 tabs and no user-generated content is the canonical use case for plain HTML. The entire application is greppable in one file, deployable as a single file, and comprehensible to any engineer in one reading session. There is no npm audit, no dependency supply-chain risk, no breaking framework upgrade, and no build step to break in CI.

**Trade-offs:**
- No component reuse primitives (managed by naming conventions and the single-file structure instead).
- No TypeScript (managed by careful naming and the small scale of the codebase).
- Adding substantial new UI sections requires discipline to avoid `index.html` becoming unmaintainable.

**Date:** Pre-baseline (decision predates source control entry)

**Future review criteria:** Revisit if the application grows beyond ~2000 lines in `index.html`, or if multiple engineers need to work on the frontend simultaneously. At that point, a lightweight build step (Vite) with no framework overhead would be the first choice — not a full framework adoption.

---

## ADR-002: Cloudflare Pages — No Dedicated Backend Server

**Decision:** The application is hosted entirely on Cloudflare Pages (static hosting). There is no VPS, no Docker container, no Node.js server, no FastAPI server running anywhere.

**Context:** The first prototype of this project (in the legacy `main.py`) used FastAPI on Render.com. That approach required managing a server process, handling cold starts, paying for compute uptime, and operating a Python environment. The pivot to Cloudflare Pages was made to eliminate all of that.

**Alternatives considered:**
- **Render.com (FastAPI):** The original approach. Required a running server, had cold starts on free tier, introduced Python dependency management, and required a `/api/*` proxy pattern anyway for CORS. Abandoned.
- **Railway / Fly.io:** Same class of problem — managed infrastructure, but still a running server with uptime concerns.
- **Vercel:** Viable alternative to Cloudflare Pages. Slightly less edge-optimised for global distribution. No strong reason to prefer it for this use case.
- **GitHub Pages:** Static files only; no serverless functions. CORS proxying for Upstox/NSE would be impossible.
- **Self-hosted VPS:** Maximum complexity, maximum ops burden, no benefit for a single-user personal tool.

**Why this approach:** Cloudflare Pages provides: global edge delivery, automatic HTTPS, zero server maintenance, generous free tier, serverless functions (Pages Functions) in the same deploy, and native support for `_headers` cache control. The only operational task is pushing code — Cloudflare handles everything else.

**Trade-offs:**
- No persistent server-side state (no in-memory caches, no background jobs, no WebSocket connections).
- Cloudflare Workers runtime limitations: no Node.js APIs, 10ms CPU limit per request (soft), 30s wall-clock limit.
- Vendor lock-in to Cloudflare's edge function runtime (migrating to Vercel Edge or AWS Lambda would require rewriting Functions, though they follow the same Fetch API standard).

**Date:** Pre-baseline (decision predates source control entry)

**Future review criteria:** Revisit if: (a) a background job is needed (e.g., daily token refresh, NAV caching), (b) the application needs server-side session state, or (c) the Cloudflare free tier limits become a constraint. First step would be Cloudflare Workers (standalone) or Cloudflare D1 — not a separate server.

---

## ADR-003: Cloudflare Pages Functions — Not a Separate Worker Service

**Decision:** API proxy routes (`/api/*`) are implemented as Cloudflare Pages Functions (file-based routing in `functions/api/*.js`) co-located in the same repository and deployment as the static site.

**Context:** Several external APIs (Upstox, NSE, Yahoo Finance, Anthropic) cannot be called directly from the browser due to CORS restrictions, authentication requirements, or IP-based restrictions. A proxy layer is mandatory. The question was where to host it.

**Alternatives considered:**
- **Standalone Cloudflare Worker (separate service):** Would require a separate `wrangler.toml`, separate deployment pipeline, separate Cloudflare project, and cross-origin configuration between the static site and the Worker. More operational overhead for no benefit at this scale.
- **Cloudflare Worker Routes attached to the Pages project:** Functionally similar to Pages Functions but requires explicit route configuration. Pages Functions are zero-config by comparison.
- **External proxy service (cors-anywhere, etc.):** Introduces a third-party intermediary that would receive the Upstox token. Completely incompatible with the security model.
- **No proxy (direct browser calls):** NSE blocks cross-origin requests. Upstox requires the token to travel in headers (acceptable) but the browser would expose the decrypted token in network logs visible to DevTools. The server-side proxy adds one layer of indirection.

**Why this approach:** Pages Functions are declared by file presence — creating `functions/api/mf.js` automatically creates the `/api/mf` route with zero configuration. Same repository, same deployment, same `git push`. The Functions share the same Cloudflare project context and environment variables as the static site. No cross-origin coordination required.

**Trade-offs:**
- Functions are coupled to the static site deployment. A change to a Function requires re-deploying the entire site (though Cloudflare makes this nearly instantaneous).
- Functions run in the Cloudflare Workers runtime, not Node.js. Any Function code must avoid Node.js APIs.
- The 10ms CPU time limit means Functions cannot do computationally intensive work — they are proxies only.

**Date:** Pre-baseline

**Future review criteria:** Revisit if a Function needs: persistent state (→ use Cloudflare KV or D1), scheduled execution (→ use Cloudflare Cron Triggers), or more than 30s wall-clock time (→ use Cloudflare Queues or Durable Objects).

---

## ADR-004: Single-File SPA (`index.html`)

**Decision:** The entire application — HTML structure, CSS, JavaScript data, helpers, load functions, and renderers — lives in a single `index.html` file (~1357 lines).

**Context:** Early in development, a multi-file structure (separate `style.css`, `app.js`, `data.js`) was considered. The single-file approach was chosen and has been maintained.

**Alternatives considered:**
- **Separate CSS file:** Would require an additional HTTP request or an import. For a personal tool with one HTML file, the round-trip cost is not worth the organisational benefit.
- **Separate JS modules:** Would require either `<script type="module">` with import/export (which changes the execution model and requires a server for local development) or a bundler. Either adds friction.
- **Multi-page app:** Separate HTML files per tab. Breaks the single-session model (PIN gate, sessionStorage-based unlock, in-memory state) that the application relies on.

**Why this approach:** The application is one logical thing. The PIN gate, data definitions, and renderers are deeply interdependent — separating them across files would require extensive import wiring for no user-visible benefit. The single-file structure means the entire system can be understood with one `grep`, reviewed in one file, and deployed as one artifact. For a solo-engineer personal tool, this is the correct optimisation target.

**Trade-offs:**
- `index.html` will grow over time. At ~2000 lines it starts to strain single-file discipline.
- CSS, JS, and HTML are interleaved; there is no independent CSS or JS linting.
- No hot module replacement in local development (not relevant — the app has no build step anyway).

**Date:** Pre-baseline

**Future review criteria:** When `index.html` exceeds ~2000 lines, or when a second engineer joins the project, evaluate extracting to separate linked files. The first extraction should be data definitions (the position/stock/fund arrays), not logic.

---

## ADR-005: No Build Step

**Decision:** The project has no `package.json`, no bundler, no transpiler, no minifier. `git push` is the entire build and deploy pipeline.

**Context:** Every build tool that is not present is a build tool that cannot break, become outdated, or require maintenance. The application uses ES2020+ JavaScript natively supported by all modern browsers. There is nothing to transpile.

**Alternatives considered:**
- **Vite:** Fast, low-config, good DX. Would enable TypeScript, HMR, and tree-shaking. But also adds `node_modules`, `vite.config.js`, and a build step to Cloudflare's deploy pipeline.
- **esbuild:** Extremely fast bundler. Same objection — adds a build artifact step.
- **Parcel:** Zero-config bundler. Still a build step.
- **Manual minification:** Pointless at the file size of this project. Cloudflare's edge gzip handles this adequately.

**Why this approach:** The deployment pipeline is: edit file → `git push` → Cloudflare deploys. This is the simplest possible pipeline. It cannot break due to a Node.js version mismatch, a lockfile conflict, or a transitive dependency change. For a personal tool maintained intermittently by one person, this reliability is worth more than the DX improvements a build tool would provide.

**Trade-offs:**
- No TypeScript (must rely on discipline and naming conventions).
- No dead code elimination (unused JS in `index.html` is served to the browser).
- No CSS preprocessing (must write plain CSS).
- Cannot use npm packages.

**Date:** Pre-baseline

**Future review criteria:** The only scenario that would justify a build step is if the project adopts TypeScript (for maintainability at larger scale) or needs to import an npm package that has no CDN-deliverable version. Neither is likely given the project's intentional scope constraint.

---

## ADR-006: Client-Side PIN Gate with SHA-256

**Decision:** Access to the dashboard is gated by a PIN. The PIN is verified client-side by comparing `SHA-256(entered PIN)` against `SHA-256(saved PIN)` stored in `localStorage`. There is no server-side authentication.

**Context:** Pulse contains sensitive financial data (portfolio values, positions, token credentials). It needs to be protected from casual access on an unattended device. At the same time, adding server-side auth (OAuth, username/password session, JWT) would require a backend, a user database, and significant operational complexity.

**Alternatives considered:**
- **Cloudflare Access (Zero Trust):** Would add enterprise-grade SSO in front of the entire site. Overhead is enormous for a single-user tool. Also adds a Cloudflare login page that breaks the Pulse identity.
- **HTTP Basic Auth (via Cloudflare Pages):** Simple but not supported natively in Pages without a Worker. Also shows a browser-native prompt that breaks the UX.
- **Server-side session (cookie + backend):** Requires a backend. Eliminated by ADR-002.
- **No auth:** Not acceptable — the dashboard is on a public domain.
- **Password stored in localStorage (plaintext):** Trivially extractable. Rejected.

**Why this approach:** The threat model is casual access on a shared or unattended device, not a determined adversary with developer tools. SHA-256 of the PIN stored in `localStorage` provides meaningful resistance to casual inspection while requiring zero server infrastructure. The PIN unlocks a `sessionStorage` entry that persists only for the browser session — closing the tab locks the dashboard again.

**Trade-offs:**
- No server-side enforcement. A determined attacker with browser DevTools access and the stored hash could run an offline brute-force attack (PINs are typically short). Acceptable for the single-user personal threat model.
- No PIN recovery. If the PIN is forgotten, `pulse_pin_hash` must be cleared from `localStorage` and the PIN reset (which also requires the Upstox token to be re-pasted, because the encrypted token blob cannot be decrypted without the original PIN).
- No multi-user support. There is one PIN for the dashboard. This is intentional.

**Date:** Pre-baseline

**Future review criteria:** Revisit if: the dashboard is accessed from a shared network, a second user needs independent access, or the threat model upgrades to include adversaries with local device access. At that point, Cloudflare Access is the right upgrade path.

---

## ADR-007: AES-256-GCM Client-Side Encryption of the Upstox Token

**Decision:** The Upstox API token is encrypted with AES-256-GCM before being stored in `localStorage`. The encryption key is derived from the user's PIN via PBKDF2 (SHA-256, 150,000 iterations, random 16-byte salt). The encrypted blob `{iv, salt, ct}` is stored as `pulse_upstox_token_enc`. The plaintext token is held transiently in memory only.

**Context:** The Upstox token grants trading-level API access to the user's brokerage account. Storing it in plaintext in `localStorage` would expose it to any JavaScript running on the page (XSS), any browser extension with `storage` permissions, and any person who opens DevTools. The token must be protected at rest.

**Alternatives considered:**
- **Plaintext in `localStorage`:** Rejected. Trivially extractable.
- **Plaintext in `sessionStorage`:** Slightly better (cleared on tab close), but still extractable via DevTools or XSS.
- **Store in a Cloudflare Worker KV under a user ID:** Would require server-side auth (see ADR-006) to identify the user. Eliminated.
- **Server-side env var only (`UPSTOX_ACCESS_TOKEN`):** Possible for a static token, but Upstox tokens are daily — requiring a Cloudflare dashboard update every trading day is not viable.
- **PIN-encrypted in `localStorage`:** Chosen. The PIN gate (ADR-006) becomes double-purpose: it also provides the decryption key.

**Why this approach:** The PIN is already known to the user. Deriving the AES key from the PIN means no additional secret needs to be managed. PBKDF2 with 150,000 iterations makes offline brute-force attacks on the PIN computationally expensive (at SHA-256 throughput on a modern GPU, 150k iterations reduces the effective cracking rate by 150,000×). AES-256-GCM provides authenticated encryption — the ciphertext cannot be tampered with without detection.

The token is only decrypted transiently in memory during `loadCC()`, passed as an HTTP header to the Cloudflare Function, and then garbage-collected. It never appears in localStorage in plaintext, never in the Function response, never in server logs.

**Trade-offs:**
- PIN change requires: clear the encrypted token, set new PIN, re-paste the token. There is no re-encryption flow.
- `crypto.subtle` requires HTTPS or localhost. The app is only served over HTTPS in production, so this is not a practical constraint.
- If the browser's localStorage is cleared, the encrypted token is lost and must be re-pasted.
- AES-256-GCM with a PIN-derived key is meaningfully weaker than AES-256-GCM with a high-entropy random key — it is only as strong as the PIN's entropy. A 4-digit PIN has 13.3 bits of entropy; PBKDF2 stretches this but does not create entropy from nothing.

**Date:** Pre-baseline

**Future review criteria:** Revisit if: the user adopts a longer passphrase (update UI hint), the PBKDF2 iteration count should increase as hardware improves (NIST recommends increasing periodically), or Web Crypto's Argon2 support becomes available (currently only PBKDF2 is supported in `crypto.subtle`).

---

## ADR-008: `localStorage` for All Persistence — No Database

**Decision:** All application state that must survive page reload is stored in the browser's `localStorage` under `pulse_*` prefixed keys. There is no external database, no Cloudflare KV store, no Cloudflare D1 instance.

**Context:** Pulse needs to persist: CC positions (strike, qty, avg, SL), the booked P&L for the current options cycle, and the encrypted Upstox token. These are small amounts of data (a few kilobytes at most) that belong to one user on one device.

**Alternatives considered:**
- **Cloudflare KV:** Server-side key-value store. Would persist data across devices. Requires an API to read/write, which requires a server-side auth model (ADR-006 eliminated server auth). Would introduce latency on every page load.
- **Cloudflare D1 (SQLite):** Relational database at the edge. Massively overpowered for this use case. Same auth requirement as KV.
- **IndexedDB:** More capable than `localStorage` (asynchronous, structured data, larger quotas). The use case does not require the additional complexity. `localStorage` synchronous API is simpler and sufficient.
- **Cookies:** Session-scoped or persistent. Not suitable for storing JSON data structures. CSRF concerns with server-side cookies.

**Why this approach:** The data is inherently device-local. A personal wealth dashboard used by one person on their own devices does not need cross-device sync. `localStorage` is synchronous (no async complexity), universally supported, trivially inspectable in DevTools, and requires zero infrastructure. The `LS` helper adds a `pulse_` prefix (avoids collisions), JSON serialisation, and try/catch error handling in a five-line wrapper — the entire "database layer" of this application.

**Trade-offs:**
- Data is not synced across devices. If the user switches devices, they must re-paste the Upstox token and re-enter any position edits made on the old device.
- `localStorage` is cleared by "Clear Site Data" in the browser. Data loss is possible through normal browser maintenance actions.
- `localStorage` quota is typically 5–10MB per origin. Not a practical concern for this dataset.
- No audit trail, no history, no rollback.

**Date:** Pre-baseline

**Future review criteria:** Revisit if: multi-device access is needed (→ Cloudflare KV with server auth), historical P&L tracking across multiple options cycles is desired (→ Cloudflare D1), or data durability across browser clears is needed (→ sync to a server). None of these are currently planned.

---

## ADR-009: The `pulse_` localStorage Key Prefix

**Decision:** All `localStorage` keys managed by the application use the `pulse_` prefix (e.g., `pulse_pin_hash`, `pulse_cc_positions_v3`). The `LS` helper applies this prefix automatically.

**Context:** Browsers share `localStorage` per origin. If multiple tools or scripts run under the same domain, their keys can collide. Even for a single-tool domain, namespacing makes it easy to identify Pulse-specific keys in DevTools.

**Alternatives considered:**
- **No prefix:** Simpler, but collisions are possible if a third-party script is ever loaded (e.g., a Google Analytics or chat widget injection from a CDN).
- **Longer prefix (`pulse_dashboard_`):** Unnecessary verbosity.

**Why this approach:** A consistent prefix makes the storage schema explicit, self-documenting, and easily debuggable in DevTools. `LS.get('pin_hash')` reads `pulse_pin_hash` — the prefix is invisible to the caller but present in storage.

**Trade-offs:** Changing the prefix in the future would orphan all existing user data. The prefix is fixed as `pulse_` in perpetuity.

**Date:** Pre-baseline

**Future review criteria:** None. This decision is permanent once users have data stored under this prefix.

---

## ADR-010: `_v3` Versioning Suffix on LocalStorage Keys

**Decision:** The CC positions and booked P&L keys include a version suffix: `cc_positions_v3` and `cc_booked_v3`. The `v3` implies two prior schema versions (`v1`, `v2`) existed.

**Context:** Early versions of the CC position data structure evolved — fields were added (e.g., `slAmt`, `sector`, `src`), types changed. Reading a `v1` blob with `v3` code would produce corrupt or missing data. Bumping the key version ensures old data is ignored rather than silently misread.

**Alternatives considered:**
- **Schema migration code:** Read `v2`, transform to `v3`, write `v3`, delete `v2`. More complex; requires maintaining migration code for every past version.
- **Single unversioned key with schema validation:** Would require per-field validation on every read. Complex and error-prone.
- **Version field inside the stored object:** Feasible, but requires read-then-validate logic.

**Why this approach:** Bumping the key version is the simplest migration strategy for a single-user tool. The cost is that old data (positions from a prior version) is lost on upgrade — but since the user can re-enter positions via the Edit UI, this is acceptable. The migration complexity saved outweighs the one-time data re-entry cost.

**Trade-offs:**
- Old data is silently abandoned (not migrated) on a version bump.
- The version suffix must be manually remembered and incremented by the engineer making schema changes.

**Date:** Pre-baseline

**Future review criteria:** If the schema changes again, bump to `v4`. Document the breaking field change in `CHANGELOG.md`. If a migration is ever needed (e.g., preserving multiple cycles of historical data), implement an explicit migration function in `LS` before changing the key name.

---

## ADR-011: Three-Tier LTP Fallback — Upstox → NSE → Manual

**Decision:** CC Basket LTPs are fetched from three sources in priority order: (1) Upstox v2 option chain API (requires user token), (2) NSE option chain (no key, cookie-based, unreliable from cloud IPs), (3) manual user input (always available). Each source fills only positions not already filled by a higher-priority source.

**Context:** Live option LTPs are essential for the CC Basket's MTM P&L calculations and action signals. Upstox is the most reliable source but requires a daily token. NSE is free but frequently blocks cloud datacenter IPs. Manual override is a last resort for when all automated feeds fail.

**Alternatives considered:**
- **Upstox only:** Simplest, but leaves the dashboard dead when the token expires or Upstox has downtime.
- **NSE only:** No token required, but heavily restricted from cloud IPs. Unreliable as a primary source.
- **Yahoo Finance for options:** Yahoo Finance does not provide reliable Indian option chain data.
- **A paid data provider (Twelve Data, Alpha Vantage):** Adds cost and API key management. The existing free sources cover the need adequately when functioning.

**Why this approach:** Options trading decisions require live data. A single feed point-of-failure is unacceptable. The three-tier design means the dashboard degrades gracefully: Upstox live → NSE live → last-known manual values. The user is always shown which tier is active (UPSTOX LIVE / NSE LIVE / MANUAL badge per card) and what error caused the fallback.

**Trade-offs:**
- NSE fallback is slow (sequential fetches, 350ms delay per symbol) and frequently fails from Cloudflare datacenter IPs.
- Manual override requires the user to look up and enter LTPs themselves — this is a last resort, not a normal operating mode.
- The fallback chain adds complexity to `loadCC()` — the `p.live` flag and `applyChain` function exist specifically to implement the "fill only unfilled positions" logic.

**Date:** Pre-baseline

**Future review criteria:** If a reliable free option chain source emerges for NSE stocks, it should replace the NSE tier. If Upstox introduces a server-to-server OAuth flow (not just daily tokens), the token management UX could be simplified.

---

## ADR-012: Upstox Token Transmitted as HTTP Header (Not URL Param or Request Body)

**Decision:** The decrypted Upstox token is sent from the browser to the Cloudflare Function as the `x-upstox-token` HTTP header. The Function reads it from `context.request.headers.get('x-upstox-token')`.

**Context:** The token must travel from the browser (where it is decrypted) to the Cloudflare Function (which forwards it to Upstox). Three transmission options exist: URL parameter, request body (POST), or HTTP header.

**Alternatives considered:**
- **URL query parameter:** Tokens in URLs appear in server access logs, browser history, and Referer headers. Rejected on security grounds.
- **POST request body:** Requires changing the Function to a POST handler, adds complexity, and makes the request non-cacheable. The options request is a GET semantically — it retrieves data, it does not create/modify anything.
- **HTTP header (`x-upstox-token`):** Does not appear in URLs or browser history. Not logged by Cloudflare in standard access logs. Standard pattern for API token forwarding.

**Why this approach:** HTTP headers are the conventional location for authentication tokens (`Authorization`, `x-api-key`, etc.). They are not stored in browser history, not included in Referer headers, and not visible in URL bars. The `x-` prefix marks it as a non-standard extension header. The GET request can remain semantically correct.

**Trade-offs:**
- The header name `x-upstox-token` is a custom convention. It must match exactly between `index.html` and `upstox-options.js`. A typo in either breaks the token flow silently (the Function receives no token, returns a 503).
- HTTP headers are still visible in DevTools → Network → Headers. This is acceptable — anyone who can open DevTools on the user's browser already has the PIN; the defence is encryption at rest, not transmission obscurity.

**Date:** Pre-baseline

**Future review criteria:** None. This is a standard, correct pattern. It should not change.

---

## ADR-013: CC Positions Hardcoded in `index.html` (Not Config-Driven)

**Decision:** The default `CC_POSITIONS` array, with initial strike/qty/avg/SL values, is declared directly in the JavaScript in `index.html`. User edits are persisted to `localStorage` and override the defaults on subsequent loads.

**Context:** The CC positions represent the current live options trades. They change only at the start of each monthly options cycle (approximately once per month). They are not high-frequency data — they are configuration-level data.

**Alternatives considered:**
- **Cloudflare KV or D1:** Server-side storage. Requires an auth model (ADR-006). Adds latency on every page load. Overkill for data that changes monthly.
- **A separate `positions.json` file:** Would require a fetch on page load, adding latency and a failure mode. The data is small enough that it belongs inline.
- **100% localStorage-driven (no defaults in source):** Would require the user to re-enter all positions on a fresh device. The hardcoded defaults act as a backup and a record of the current cycle's positions.
- **Admin UI with backend persistence:** Out of scope for a personal tool.

**Why this approach:** For a single-user personal dashboard updated monthly, the simplest correct approach is to define the positions in source code. The Edit UI allows in-session adjustments that persist to `localStorage`. If `localStorage` is cleared, the positions revert to the last committed defaults in `index.html` — which represent the last explicitly saved cycle configuration.

**Trade-offs:**
- Changing positions (new cycle, closed trade) requires editing `index.html` and deploying. This is a ~60-second operation (edit → push → Cloudflare deploys).
- If the user makes edits via the UI and then `localStorage` is cleared, edits are lost.
- The hardcoded positions include financial data (strikes, quantities, averages) that, while not secret, represents the portfolio. The file is in a private repository, so this is acceptable.

**Date:** Pre-baseline

**Future review criteria:** Revisit if: the positions change more frequently than once a week (→ make the UI the source of truth, write `localStorage` as primary, remove defaults from source), or a second device needs the same positions (→ Cloudflare KV).

---

## ADR-014: Upstox `UNDERLYINGS` Map Hardcoded in the Function

**Decision:** The mapping of ticker symbol to Upstox `instrument_key` (e.g., `HDFCBANK → NSE_EQ|INE040A01034`) is hardcoded in `functions/api/upstox-options.js`.

**Context:** The Upstox API requires an `instrument_key` in ISIN format (`NSE_EQ|{ISIN}`) to identify each underlying. This mapping cannot be inferred from the ticker alone — it requires a lookup against the Upstox instrument master.

**Alternatives considered:**
- **Browser-side mapping in `index.html`:** Would expose the full mapping to the browser, where it is harmless (ISINs are public). But it would also require passing the instrument key as a query parameter to the Function, adding URL complexity.
- **Dynamic instrument lookup on each request:** The Upstox API offers an instrument search endpoint. Calling it per request adds latency and a potential failure point.
- **Configurable via localStorage/env var:** Overly complex for data that changes only when the strategy changes (a new stock is added to the CC basket).

**Why this approach:** The set of underlying stocks in a CC basket is stable — it might change two or three times per year at most. Hardcoding the mapping in the Function is the simplest correct approach. The Function is deployed via source control, so changes are tracked and reviewed.

**Trade-offs:**
- Adding a new CC symbol requires editing the Function file and redeploying. This is a deliberate friction point — adding a new underlying to a CC strategy should be a conscious decision, not a casual UI action.
- If Upstox changes an ISIN (extremely rare — ISINs are permanent identifiers), the map must be updated.

**Date:** Pre-baseline

**Future review criteria:** If the CC basket regularly rotates 5+ symbols per month, consider moving the mapping to an editable section of `index.html` stored in `localStorage`. Currently unnecessary.

---

## ADR-015: `p.live` Flag Reset at Every `loadCC()` Call

**Decision:** At the start of every `loadCC()` execution, `CC_POSITIONS.forEach(p => { p.live = false; })` resets the `live` flag on every position before any fetch attempts.

**Context:** The `applyChain()` function, which maps fetched LTPs to positions, uses `if(p.live) return` to prevent a lower-priority source (NSE) from overwriting a higher-priority source (Upstox) within a single `loadCC()` call. Without the reset, `p.live = true` set by a prior `loadCC()` call would cause `applyChain` to skip all positions permanently on every subsequent call — LTP values would freeze after the first successful fetch.

**Alternatives considered:**
- **Remove the `if(p.live) return` guard entirely:** Would allow NSE to overwrite Upstox on every call. Upstox runs first; NSE runs only for unfilled positions. Removing the guard would mean NSE could overwrite a valid Upstox LTP with a stale NSE LTP (NSE is slower and sometimes wrong). Rejected.
- **Pass a source priority parameter to `applyChain`:** More explicit, but the flag serves the same purpose more simply.
- **Use a separate set of `filledBy` codes outside the position object:** More complex for the same result.

**Why this approach:** The reset ensures each `loadCC()` call is a fresh, independent fetch. The `if(p.live) return` guard then correctly does its one job within a single call: preventing NSE from overwriting Upstox. The two-line fix (`window._upstoxErr=null; CC_POSITIONS.forEach(p=>p.live=false)`) at the start of `loadCC()` is the canonical implementation.

**Trade-offs:** None. This is the correct implementation. The alternative (not resetting) was a bug that caused LTP freeze — it was the primary defect fixed in the initial source control baseline.

**Date:** 2026-07-04 (fixed in commit `c3b5727`)

**Future review criteria:** If `loadCC()` is refactored to be event-driven or streaming, the reset should move to the beginning of whatever initiates a new fetch cycle.

---

## ADR-016: Sequential NSE Fetches with 350ms Inter-Request Delay

**Decision:** The NSE option chain fallback function (`functions/api/options.js`) fetches symbols sequentially in a `for...of` loop with a `setTimeout(350)` delay between each symbol, rather than fetching in parallel.

**Context:** NSE's API does not publish rate limit documentation, but empirically, parallel requests from the same IP are frequently rejected with 429 errors or dropped connections. A 350ms delay between requests has been observed to reduce rejection rates.

**Alternatives considered:**
- **Parallel fetch with `Promise.all`:** Faster, but NSE rejects concurrent requests from the same IP more aggressively.
- **Longer delay (500ms, 1000ms):** More conservative but increases total latency proportionally. At 12 symbols, 1000ms delay = 12 seconds minimum — too slow for a UX refresh.
- **Retry logic on 429:** Would increase resilience but add code complexity. For a best-effort fallback, the added complexity is not justified.

**Why this approach:** 350ms is an empirically-derived value that balances reliability (lower rejection rate) against latency (at 12 symbols maximum, worst-case total time ≈ 4.2 seconds, within the acceptable timeout window). The NSE fallback is already a degraded mode — optimising it for speed at the cost of reliability is the wrong trade-off.

**Trade-offs:**
- Worst-case NSE fetch time is `symbols × 350ms + network_latency`. At 7 symbols, ≈ 2.5 seconds. At 12 symbols (the configured maximum), ≈ 4.2 seconds.
- NSE frequently blocks cloud datacenter IPs regardless of rate. The delay helps at the margin but does not solve the fundamental IP-block problem.

**Date:** Pre-baseline

**Future review criteria:** If NSE changes its rate limiting behaviour, adjust the delay. If a reliable alternative Indian option chain source emerges, replace NSE entirely.

---

## ADR-017: `public` Cache-Control on Cloudflare Edge for API Responses

**Decision:** All `/api/*` Function responses use `Cache-Control: public, max-age=N` headers. Yahoo Finance and Upstox use 60s; NSE uses 120s; mfapi.in uses 3600s. `index.html` uses `no-store, must-revalidate`.

**Context:** Cloudflare edges can cache Function responses. `public` means the edge (not just the browser) can cache the response. For a single-user deployment, all requests come from the same user — the distinction between public and private cache is practically irrelevant but architecturally significant.

**Alternatives considered:**
- **`private, max-age=N`:** Browser-only cache. Would bypass Cloudflare edge caching, resulting in a fresh Function invocation on every tab load even within the same browser session.
- **`no-cache`:** Revalidation on every request. Adds latency without benefit given the data freshness requirements.
- **No cache header:** Cloudflare's default behaviour for Function responses is no caching. Every `loadCC()` call would hit the Function and then Upstox, regardless of recency.

**Why this approach:** The 60-second Upstox cache means that clicking `↻ LTPs` twice in 60 seconds returns the same cached data from the Cloudflare edge without hitting Upstox a second time. This protects the Upstox API from being hammered by repeated refreshes and keeps Function invocation counts low. For a single-user site, `public` vs `private` is a distinction without a difference.

**Trade-offs:**
- If this deployment were ever used by multiple users simultaneously, `public` caching would mean all users see the same Upstox LTPs (from the first request within the cache window). This could expose one user's position data in the API response to another user. Currently not a concern (single-user, private deployment).
- `index.html` is intentionally excluded from caching (`no-store`) so that code deployments are immediately reflected without requiring users to hard-reload.

**Date:** Pre-baseline

**Future review criteria:** If the deployment becomes multi-user, change Upstox and NSE responses to `private, max-age=60` immediately.

---

## ADR-018: Anthropic Claude API for AI Briefing — Optional, Not Required

**Decision:** The AI briefing feature on the Overview tab calls Anthropic's Claude API via a Cloudflare Function proxy (`/api/summary`). The feature is entirely optional: if `ANTHROPIC_API_KEY` is not set, the Function returns `{"error": "no_key"}` with HTTP 200, and the dashboard renders a graceful "unavailable" message. The dashboard is fully functional without it.

**Context:** An AI-generated daily briefing was desired to synthesise portfolio state across modules. It required an LLM API. Anthropic was chosen as the operator.

**Alternatives considered:**
- **OpenAI GPT:** Functionally equivalent. No strong technical reason to prefer one over the other for this use case. Anthropic chosen.
- **Local/on-device LLM:** Not viable in a browser-based application with a Cloudflare Function backend (Workers have no GPU access).
- **Rule-based briefing (no LLM):** Possible but would produce rigid, template-like summaries. The LLM adds genuine synthesis.
- **Required feature (hard failure if missing):** Rejected. The AI briefing is a convenience. Failing to load it should not break the dashboard.

**Why this approach:** Making the feature opt-in (env var present = enabled, absent = gracefully disabled) means the dashboard can be deployed and used without any Anthropic relationship. The token cost is low (max 500 output tokens per briefing), and the feature adds genuine value when available.

**Trade-offs:**
- The model ID (`claude-sonnet-4-20250514`) is hardcoded. As Anthropic deprecates model versions, this must be updated.
- The prompt is constructed by the browser and sent to `/api/summary` — the Function truncates it to 8000 chars but does not validate content. Malicious content injection into the prompt is not a concern for a single-user personal tool.
- Anthropic API costs are real (minor for 500 tokens/request at low frequency, but non-zero).

**Date:** Pre-baseline

**Future review criteria:** Update the hardcoded model ID when Anthropic deprecates `claude-sonnet-4-20250514`. Consider switching to the latest available Claude model at that time.
