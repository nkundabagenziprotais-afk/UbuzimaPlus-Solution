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

- Shell: fixed header, independent left navigation, independent content scroll.
- Navigation: folded tree menu by default, with compact icon badges and sub-menu descriptions.
- Left menu roots:
  - ERP Module: ERP Overview, Finance, HR, Procurement, Projects, Customer Care.
  - Solution Portfolio: PharmaCore 360, VetCore 360, ClinicCore 360, InsuCore 260.
  - AI Center: AI Governance, Provider Management, Model Registry, Agents, Prompt Library, Knowledge Base, Data Connectors, Recommendations, Workflow Automation, Approval Center, Feedback, Usage and Cost, Risk Compliance, Audit Logs, Insights.
  - Admin Panel: Backend API, Web Application, Mobile Application, Desktop Application, Data Layer, Infrastructure.
- State: active section must persist locally so user changes do not reset the workspace to the top menu.
- Header actions: Back, Website, Email Corporate, signed-in user, scope, and status.
- Header: authenticated workspace, scope, user status, and role context.
- Summary: active roles, permissions, tenant assignments, admin scopes.
- System experience blueprint: Operate, Control, Grow, Connect.
- Commercial platform framework: platform core, PharmaCo360 operations, growth modules, AI Center.
- 360 views: platform, solution, tenant, branch, product, supplier, customer, AI.
- Channel readiness: public website, admin dashboard, tenant portal, mobile app, desktop/PWA POS.

## Solution Portfolio Flow

PharmaCore 360 is the active solution. Selecting it from the left tree should immediately show the dedicated solution segments below the fixed header:

- Retail Pharmacy
- Wholesale Pharmacy
- Retail-to-wholesale procurement
- Delivery and dispatch
- Insurance and clinic links
- AI insights

Selecting a segment opens the third section below it. For Retail Pharmacy, priority features are AI Model, Inventory, POS, Product Master, Procurement, Prescriptions, Customers, and Reports. Feature visibility must be filtered by solution, tenant, package, role, branch, and permissions.

Recommended tenant dashboards:

- Owner dashboard: sales health, stock value, cash and credit, branch performance, exceptions, and strategic AI recommendations.
- Finance dashboard: receivables, payables, collections, supplier payments, daily close, and export readiness.
- Branch manager dashboard: today sales, tills, stock alerts, expiry risk, staff activity, and approvals.
- Inventory officer dashboard: product master, batches, expiry, receiving, adjustments, transfers, and shelf readiness.
- Cashier/POS dashboard: teller session, product search, cart, payment, prescription flags, held sales, returns, and close till.
- Pharmacist dashboard: prescription checks, controlled medicine alerts, dispensing safety, substitutions, refill follow-up, and audit notes.

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

## Priority UX Workspaces

AI Center:

- Document intake, structured extraction, reconciliation, approval queue, and controlled apply.
- AI must show extracted content inside the platform before approval; approving a file alone is not enough.
- Bulk approval requires visible differences, affected fields, risk, and audit trail.
- Long extraction jobs should be queued or chunked to avoid web request timeout failures.

Inventory:

- Product master, batch, expiry, FEFO, receiving, stock movement, low stock, near-expiry, and shelf arrangement readiness.
- Offline lookup can be allowed by policy, but stock changes must remain pending sync and must not blindly overwrite online inventory.
- Shelf and warehouse arrangement AI stays advisory until inventory officers approve it.

POS:

- Teller session, teller PIN, fast barcode/product search, FEFO batch selection, prescription control, payments, supervisor approval, and till close.
- Institution pay-later and OTP workflows must be explicit and audit-ready.
- Receipt screens must not claim official RRA/EBM compliance until the official integration is configured and approved.

## Implementation Rules

- Keep existing API contracts, auth flow, migrations, and deployment scripts intact unless a backend task explicitly requires changes.
- Build module UI progressively. Planned modules may be visible in framework pages but must be marked planned, controlled, later, or progressive.
- Every module should expose a 360 view with summary, alerts, tasks, activity, audit context, and next actions.
- Never show production-looking fake statistics. Use real API data, empty states, planned labels, or clearly marked demo/development states.
- AI recommendations must show reason, confidence, risk, data signal, approval status, and audit trail before being operational.
- Public website copy must speak to external customers. Internal pilot or repository language belongs in docs and admin views.
