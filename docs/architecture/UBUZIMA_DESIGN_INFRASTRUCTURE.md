# Ubuzima+ Design Infrastructure

This file defines the shared UI direction for the Ubuzima+ platform so future design, ChatGPT-assisted work, and implementation can continue from the same foundation.

## Brand Assets

- Primary logo asset: `web/public-website/public/assets/ubuzima-logo.png`
- Admin logo asset: `web/admin-dashboard/public/assets/ubuzima-logo.png`
- Public hero asset: `web/public-website/public/assets/ubuzima-pharmaco-hero.png`
- Logo usage: place the logo on white or very light surfaces. On dark navigation, wrap the logo in a small white 8px-radius container.

## Core Design Tokens

- Blue: `#0877c9`
- Green: `#36ad3a`
- Deep teal: `#073844`
- Ink: `#10231f`
- Soft surface: `#f5f8f7`
- Line: `#dbe7e3`
- Amber attention: `#c9811c`
- Radius: 8px for cards, panels, buttons, chips, and brand containers.
- Letter spacing: 0 for headings, cards, buttons, and compact UI.

## Public Website Model

The public website is for external customers and partners. It should not read like internal architecture notes.

- First viewport: logo, customer value, demo request, PharmaCo360 exploration, and health-operations credibility.
- Navigation: Solutions, PharmaCo360, Customers, Platform, Security, Request Demo, Staff Login.
- Staff login: `/staff-login`, `/login`, and `/staff` redirect to the configured admin dashboard URL.
- Sections: solution lines, module framework, customer audiences, platform channels, AI Center, security, implementation path, roadmap, contact.

## Staff Platform Model

The authenticated dashboard should feel like an operating console, not a marketing page.

- Header: authenticated workspace, scope, user status, and role context.
- Summary: active roles, permissions, tenant assignments, admin scopes.
- System experience blueprint: Operate, Control, Grow, Connect.
- Commercial platform framework: platform core, PharmaCo360 operations, growth modules, AI Center.
- 360 views: platform, solution, tenant, branch, product, supplier, customer, AI.
- Channel readiness: public website, admin dashboard, tenant portal, mobile app, desktop/PWA POS.

## Full Module Framework

Core modules:

- Business setup
- Users, roles, and permissions
- Product and drug master
- Inventory and stock movement
- POS, sales, and dispensing
- Procurement and suppliers
- Payables
- Receivables and customer credit
- Reports and BI

Growth modules:

- Customer engagement
- Wholesale catalog
- Retail-to-wholesale procurement
- Delivery and dispatch
- Insurance claims
- Clinic integration
- Finance exports and accounting integration
- Mobile manager app
- Desktop/PWA POS

AI modules:

- AI governance
- Provider registry
- Model registry
- Agent registry
- Prompt library
- Knowledge base
- Recommendation queue
- Human approval center
- Feedback and evaluation
- Usage, cost, risk, and audit logs

## Implementation Rules

- Keep existing API contracts, auth flow, migrations, and deployment scripts intact unless a backend task explicitly requires changes.
- Build module UI progressively. Planned modules may be visible in framework pages but must be marked planned, controlled, later, or progressive.
- Every module should expose a 360 view with summary, alerts, tasks, activity, audit context, and next actions.
- Never show production-looking fake statistics. Use real API data, empty states, planned labels, or clearly marked demo/development states.
- AI recommendations must show reason, confidence, risk, data signal, approval status, and audit trail before being operational.
- Public website copy must speak to external customers. Internal pilot or repository language belongs in docs and admin views.
