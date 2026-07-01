# Ubuzima+ UI/UX Commercial Platform Revision

This revision plan turns the master architecture into a simpler, commercially viable platform experience without changing backend contracts, migrations, authentication, or deployment configuration.

Shared design direction, brand tokens, logo assets, module groups, and implementation rules are recorded in `docs/architecture/UBUZIMA_DESIGN_INFRASTRUCTURE.md`.

## Design Direction

- Use a corporate service structure similar to strong banking and enterprise websites: utility bar, clear navigation, image-led hero, quick actions, solution cards, audience routes, trust content, and direct contact.
- Do not copy another brand's colors, assets, text, layout, or identity.
- Keep Ubuzima+ positioned as the umbrella platform, PharmaCo360 as the first solution, and VitaPharma as the first tenant.
- Show the full future framework, but mark modules as active, controlled, planned, or later so users are not confused.
- Make every dashboard a 360 view: summary, alerts, pending tasks, quick actions, recent activity, audit-sensitive events, and AI explanation where relevant.

## Simplicity Rules

- One primary task per screen.
- Navigation must be role-based and hide irrelevant actions.
- Tables should start with the operator's decision fields: status, risk, due date, amount, responsible user, and next action.
- Forms should be split into short sections with validation near the field.
- Use empty states that tell the user what to do next.
- Keep AI advisory unless the workflow has human approval and audit logs.
- Every module must show tenant, branch, permission, and activation status when context matters.

## Public Website

Required improvements:

- Replace the placeholder homepage with a product-led commercial site for Ubuzima+.
- Keep the homepage language focused on external customers: pharmacy owners, branch managers, clinics, suppliers, and health business groups.
- Add quick actions for demo, PharmaCo360, implementation path, and staff login.
- Provide a public `/staff-login` route that redirects authorized staff to the admin dashboard login page.
- Present PharmaCo360, ClinicCo360, VetCo360, and Ubuzima ERP as solution lines.
- Show PharmaCo360 modules clearly, including active and future modules.
- Add audience routes for retail pharmacies, wholesale pharmacies, clinics, suppliers, and health business groups.
- Add trust messaging for tenant separation, RBAC, audit logs, module activation, support access, and AI approval.
- Use generated or owned product visuals only.

## Auth And Access

Required improvements:

- Keep sign-in simple and tenant-aware.
- Add clearer development user selection for local review.
- Add future two-factor and password reset placement.
- Show active scope after login: platform, solution, tenant, branch, and permissions.
- Make missing access states helpful instead of only technical.

## Platform Admin

Best presentation:

- Start with platform health, tenants, solutions, module activations, security alerts, support requests, billing readiness, and AI usage.
- Use activation status chips for modules: draft, available, active, suspended, deprecated.
- Add tenant onboarding progress: profile, domain, branches, users, products, stock import, POS training, reports, AI sandbox.
- Add support access request flow with reason, approver, time window, and audit trail.

## Solution Admin

Best presentation:

- Show PharmaCo360 tenant portfolio, onboarding stage, active module count, reporting readiness, AI readiness, and open operational risks.
- Provide solution-level templates for workflows, permissions, product catalogs, reporting, and AI rules.
- Keep tenant-sensitive records behind permissioned support access.

## Tenant Admin

Best presentation:

- Show VitaPharma branch health, active users, today's sales, inventory alerts, supplier tasks, credit risk, payables, and pending approvals.
- Provide quick actions for user invite, branch setup, product import, receive stock, create sale, record payment, and refresh reports.
- Add a visible module activation panel so tenant admins understand what is available now and what is coming later.

## Pharmacy Profile And Branches

Required UX:

- Use a setup checklist for legal identity, trading name, regulator, license, contacts, operating hours, payment methods, tax settings, and insurance partners.
- Show branch cards with branch type, status, stock locations, departments, counters, manager, and opening status.
- Add branch 360 view for stock, POS, users, alerts, daily close, and audit events.

## Product Master

Required UX:

- Present products in a dense searchable table with SKU, barcode, category, dosage, strength, unit, prescription flag, status, and last update.
- Add import flow for first tenant data with preview, validation, duplicate handling, and rollback notes.
- Add product 360 view for stock, batches, expiry, purchases, sales history, supplier options, margin, and AI reorder advice.

## Inventory

Required UX:

- Prioritize stock status: in stock, low stock, out of stock, expiring soon, expired, overstocked, and movement exceptions.
- Show batch and expiry information before secondary details.
- Add movement ledger view with receive, dispense, transfer, adjust, return, damage, and audit trail.
- Add exception queues for stock mismatch, negative stock attempts, expiry risk, and high-value adjustments.

## POS, Sales, And Dispensing

Required UX:

- Build a counter-optimized POS/PWA mode with barcode-first search, fast cart, prescription warning, batch assignment, payment capture, and receipt.
- Keep sales confirmation strict: draft review, batch match, prescription validation, stock deduction, and audit log.
- Add daily close screen for cashier totals, payment methods, exceptions, and manager approval.
- Use clear safety states: draft, ready to dispense, blocked, dispensed, partially paid, paid, cancelled, voided.

## Procurement And Suppliers

Required UX:

- Show reorder suggestions, purchase requests, purchase orders, goods received, invoices, and supplier performance in one flow.
- Make supplier 360 view include catalog, pricing, purchase history, delivery reliability, invoice status, and payment status.
- Add compare supplier view for price, lead time, stock availability, payment terms, and past quality issues.

## Payables

Required UX:

- Present supplier invoices by due date, status, amount, paid amount, balance, supplier, and linked purchase order.
- Add settlement workflow with payment method, reference, approval state, and audit log.
- Add aging summary and overdue alerts.

## Receivables And Customer Credit

Required UX:

- Show customer credit exposure by aging bucket, due date, original amount, collected amount, balance, and risk status.
- Add payment collection workflow with receipt, reference, notes, and audit trail.
- Keep CSV export permissioned and explain what date the export represents.

## Reporting And BI

Required UX:

- Keep reporting read-only unless a workflow explicitly allows action.
- Use executive cards for stock valuation, sales, collection rate, procurement, payables, and customer credit exposure.
- Add branch comparison, product movement, supplier performance, margin, expiry, stockout, and finance summaries.
- Empty and loading states must explain that reports do not mutate pharmacy records.

## Ubuzima AI Center

Required UX:

- Create separate views for AI governance, provider registry, model registry, agent management, prompt library, knowledge base, recommendations, approvals, usage/cost, risk, and audit logs.
- Every recommendation must show title, confidence, risk, reason, data-source summary, action, approval status, and audit trail.
- Add approval queue for reorder proposals, customer messages, price changes, permission recommendations, and sensitive actions.
- Keep external AI disabled until encrypted secrets, sandbox testing, and approval are complete.

## Customer Engagement

Required UX:

- Start with customer profile, refill history, communication consent, chronic medicine follow-up, feedback, and loyalty readiness.
- Add refill reminder queue with human approval in early phases.
- Add clear privacy and opt-out states.

## Wholesale Ecosystem

Required UX:

- Show wholesale catalog, bulk pricing, retailer order requests, invoice flow, availability, and demand analytics.
- Add retail-to-wholesale procurement view for browsing, comparing, ordering, receiving, and reconciling.
- Add wholesale opportunity insights after core retail data is stable.

## Delivery And Dispatch

Required UX:

- Show delivery queue by status: pending, assigned, picked, in transit, delivered, failed, returned.
- Add proof of delivery, OTP confirmation, failed-delivery reason, driver/agent assignment, and customer contact control.
- Use mobile-first layouts for delivery agents.

## Insurance And Clinic Integration

Required UX:

- Insurance module should handle partners, covered products, co-payment, claim creation, claim status, reconciliation, and rejected claim resolution.
- Clinic integration should show partner clinics, e-prescription intake, prescription status, referral flow, and pharmacy fulfillment.
- Keep these modules marked as later until partner workflows and data protection rules are approved.

## Mobile App

Required UX:

- Prioritize manager alerts, approvals, stock summaries, delivery tasks, branch dashboards, and push notifications.
- Avoid full desktop tables on mobile.
- Use short action queues and drill-down views.

## Desktop/PWA POS

Required UX:

- Build as installable PWA first.
- Prioritize speed, barcode input, receipt printing, cashier session, offline-ready structure, and large touch targets.
- Keep admin configuration out of the counter screen.

## Implementation Guardrails

- Do not break existing API endpoints.
- Do not change migrations or auth behavior during UI polish unless explicitly planned.
- Do not expose hidden tenant data in demo screens.
- Do not show fake statistics as production facts.
- Any new module shown before implementation must be marked planned, controlled, or later.
- Run frontend builds and existing guardrail scripts after UI changes.
