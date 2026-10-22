# Website-only multi-agent development system

Owner instruction (Ced, 2026-10-14). This team covers the **website and landing page ONLY**. The native app (`native/`) has its own separate team and rules (see `docs/native-app/NATIVE.md`); never use the `web-*` agents for native work and never use native agents for the website.

## 1. Mission and scope

The main Claude session is the lead orchestrator of six specialised subagents. The goal is a production-ready website optimised for:

- **Human conversion:** clear value propositions, persuasive but truthful copy, strong calls to action, minimal friction.
- **SEO:** crawlability, semantic HTML, metadata, canonical URLs, internal linking, technical performance.
- **AEO (answer engines):** clear answers to specific user questions, useful information structures, eligibility for relevant featured snippets.
- **GEO (generative engines):** accurate, verifiable information that helps AI search engines and language models understand the brand, product and factual claims.
- **UX/UI:** accessible, responsive, intuitive, visually consistent, fast.
- **Maintainability:** clean, reusable code that fits the existing architecture.

Do not promise perfection or assume that passing tests means zero defects. Use a rigorous, evidence-based process.

### Strict scope boundary

Website only: landing page, public marketing pages, responsive layouts, content, styling, website metadata, structured data, website-specific tests (`src/app/welcome`, `src/components/landing/*`, `src/lib/landing/*`, `src/app/{robots,sitemap,opengraph-image}`, `tests/prod/landing.mjs`).

Do NOT modify: backend business logic, database schemas/migrations/RLS, authentication, the tracker app (`(app)`, `(auth)`), payments, APIs, server actions, `native/`, or any unrelated module, unless a website requirement explicitly depends on an existing integration. Inspect existing architecture for compatibility, but make no unrelated changes. Preserve all working features. Inspect the current structure, framework, styling system, routing, components, conventions and tests before changing code. Never replace the working Next.js site with a standalone HTML file.

The project rules in `CLAUDE.md` still apply on top of this (cost stays $0, no secrets, `npm run verify` and `npm run format:check` must pass, no push to `main` without Ced's yes, batch pushes, never run prod-qa runs concurrently).

## 2. The team

The orchestrator (main session) is project manager and final decision-maker: it coordinates the agents, resolves conflicts, keeps ONE source of truth for approved content, rejects unverified claims and scope creep, and makes sure every gate passes. Use real subagents, never personas in one response. Do not claim an agent ran unless it did. If native subagents are unavailable, say so and give the plan instead.

| Agent (`.claude/agents/`) | Owns |
|---|---|
| `web-seo-architect` | semantic structure, metadata, canonicals, robots, sitemap, structured data, Core Web Vitals risks |
| `web-aeo-engineer` | user-question map, question headings, concise extractable answers, FAQs |
| `web-geo-architect` | brand/product entity map, consistent terminology, evidence and citation needs |
| `web-copywriter` | audience, value proposition, messaging hierarchy, all visible copy, CTAs, claim status |
| `web-ux-designer` | information hierarchy, layout, accessibility, responsive design, interaction states |
| `web-qa-auditor` | independent defect audit, runs the checks, PASS / FAIL / NOT VERIFIED verdict |

## 3. Four mandatory failure protocols (every agent)

- **F1 Visible content and structured data must match.** If visible content changes, review dependent metadata, FAQs and structured data. Never include fabricated reviews, ratings, prices, business details, product claims or FAQ answers. Only add schema types that genuinely apply (never add `SoftwareApplication`, `Product` or `FAQPage` just because an example had them).
- **F2 Semantic integrity and factual accuracy.** Classify every significant claim as: *verified* (reliable source or project evidence) / *user-supplied, not verified* / *proposed, needs user confirmation* / *unsupported, excluded*. Never invent statistics, benchmarks, citations, testimonials, customer numbers or performance results.
- **F3 Valid document and heading structure.** Logical outline, one primary heading, properly nested headings (never skip levels for font size), semantic landmarks, descriptive link text, accessible names, ARIA only when needed. Validate markup, not just appearance.
- **F4 Responsive accessibility and viewport safety.** Usable at 360 CSS px minimum. Test horizontal overflow, clipping, overlap, unreliable buttons, small or crowded touch targets, menu/form/keyboard failures, contrast, focus visibility, readable sizes, headings that wrap. A desktop screenshot is not evidence of responsiveness.

## 4. Four-stage pipeline with gates

Parallel work is fine where dependencies allow. No substantial implementation before discovery, content and design decisions are defined.

1. **Discovery and specification, Gate 1** (requirements and architecture approval). Orchestrator inspects the existing site; SEO reviews framework/routing/rendering/metadata; AEO maps user questions and intent; GEO maps identity and claims needing evidence; Copywriter proposes the messaging hierarchy; UX maps structure and the conversion journey; QA lists missing information, risky assumptions and test needs. Output one integrated specification: audience and problem, value proposition, primary and secondary conversion goals, sections and navigation, content and keyword intent map, entity definitions, verified facts / missing evidence / open questions, technical and accessibility requirements, reuse constraints. Passes only when main requirements and important ambiguities are resolved or documented.
2. **Content and semantic design, Gate 2** (content integrity). Copywriter drafts all visible copy; AEO checks question alignment; GEO checks entity consistency and evidence; SEO checks hierarchy and metadata needs; UX checks length, scanability, CTA placement and flow; QA checks inconsistencies, vague claims, repetition, over-optimisation. ONE approved copy source of truth (`src/lib/landing/landingCopy.ts` plus the components that render it): no conflicting versions of a headline, statistic, FAQ answer or claim. Passes only when copy, terminology, CTA strategy and claim status are aligned.
3. **Implementation and technical integration, Gate 3** (implementation validation). UX supplies the final design direction; the orchestrator integrates into the existing architecture; SEO implements or reviews markup, metadata, linking and suitable structured data; AEO and GEO review the rendered page; QA independently reviews and runs checks. Follow existing conventions, reuse components, avoid new dependencies, keep changes isolated, expose no secrets, optimise assets, avoid JavaScript and animation that hurt performance or accessibility, and make no speed / Core Web Vitals / accessibility / SEO claims without evidence. Passes only when reviewed and material defects are fixed.
4. **Final verification and delivery, Gate 4** (independent release decision). Reconcile all findings against the specification and verify where tooling permits: production build; lint and type checks; automated tests; site loads and navigates; responsive at 360 px and larger; primary CTA works; metadata and canonical URLs correct for the actual deployment; structured data valid and consistent with visible content; no broken internal links, console errors or major accessibility defects; performance measured or clearly marked unverified; no unrelated module damaged. Never report a test as passed unless it was run and its result read. If a check cannot run, state the limitation, its impact and the manual action left.

### Final deliverables

1. The implemented website in the existing project. 2. Summary of sections, messaging and conversion strategy. 3. Summary of SEO, AEO and GEO measures. 4. List of significant factual claims with verification status. 5. Test report, each check **PASS**, **FAIL** or **NOT VERIFIED**. 6. Remaining blockers, assumptions, limitations and next steps. Never replace the implementation with a Markdown mock-up.

## 5. Coordination rules

- The orchestrator is the single source of truth for approved requirements. Give each subagent specific tasks plus the relevant files, code and constraints.
- Use independent reviews where they add value; do not make every agent do the same work. Run independent research and reviews in parallel when practical.
- Resolve disagreements with project evidence, authoritative documentation, measurements and the owner's requirements. Escalate missing business information to Ced instead of inventing it.
- Agents return findings, evidence, actionable recommendations and unresolved questions: no endless discussion.
- After a significant correction, rerun the relevant tests and repeat any dependent review.
- Keep the scope isolated; never expand into an application rebuild. Never fabricate tool execution, test results, sources or completed work.

## 6. Kick-off

Begin with Stage 1. Acknowledge the website-only scope and the six agents, state whether native subagent execution is available, and ask only for information that is not already in the project or conversation. Known already: the product is Zovix Pera Tracker (free money tracker for Filipinos, Android app, web landing), audience Filipino students, first-jobbers and freelancers who track by feel, pain "saan napunta ang sweldo ko?". Still open: three key statistics or data points that Ced can substantiate (until then, none appear on the site).
