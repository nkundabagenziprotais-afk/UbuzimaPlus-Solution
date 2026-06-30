# PharmaCo360 Operations Command Center QA

## Purpose

The PharmaCo360 operations command center gives managers a read-only operating picture before they open detailed workflow panels.

It summarizes stock value, sales collection, customer credit risk, supplier balance, purchase follow-up, and manager review notes.

## Functional checks

1. Log in as the VitaPharma tenant admin.
2. Confirm the command center appears near the top of the authenticated workspace.
3. Confirm the heading says `Today’s operating picture`.
4. Confirm the refresh action is visible and usable.
5. Confirm stock, sales, customer credit, and supplier balance cards render.
6. Confirm priority follow-up cards render.
7. Confirm manager review notes render.
8. Confirm refresh uses tenant-safe read-only report APIs.
9. Confirm no sale, stock, purchase order, receivable, payment, supplier, or invoice record is mutated.

## Responsive review checklist

- 360px: KPI cards stack cleanly and the refresh button is tappable.
- 430px: priority follow-up cards are readable without horizontal overflow.
- 768px: KPI cards use balanced two-column spacing.
- 1280px: command center feels like the main pharmacy operating view.
- 1440px: spacing remains professional and not crowded.
- 1920px: content remains readable and not stretched.

## Safety notes

This phase introduces no backend change, no migration, no dependency change, and no production data mutation.

The command center must remain read-only.

## Phase 14.2 operational alerts and review queues

Functional checks:

1. Confirm `Operational alerts` appears inside the command center.
2. Confirm customer credit, supplier payables, sales collection, purchasing, and stock visibility alerts render.
3. Confirm `Review queues` appears inside the command center.
4. Confirm credit collection, supplier payment, purchase receiving, and sales collection queues render.
5. Confirm alerts and queues are generated from existing read-only reporting data.
6. Confirm no stock, sale, receivable, payment, supplier, invoice, or purchase order record is changed by refreshing the command center.

Responsive checks:

- 360px: alerts and queues stack in one column without horizontal overflow.
- 430px: alert details remain readable and the refresh button is tappable.
- 768px: queues remain clear in tablet view.
- 1280px: alerts fit the command center without crowding.
- 1440px: command center looks like an executive operating view.
- 1920px: alert and queue cards remain readable and not stretched.

## Phase 14.3 responsive polish and operator review checklist

Functional checks:

1. Confirm `Operator review checklist` appears inside the command center.
2. Confirm cash and collections, credit control, supplier exposure, and stock attention review cards render.
3. Confirm the checklist is advisory only and does not submit, approve, mutate, or delete records.
4. Confirm the command center still refreshes from read-only tenant-safe reporting APIs.
5. Confirm Phase 14.1 and Phase 14.2 guardrail scripts still pass.

Responsive approval checklist:

- 360px: command center cards stack without horizontal scrolling.
- 430px: refresh button, period note, alerts, queues, and checklist cards are readable.
- 768px: KPI, alert, queue, and checklist layouts remain balanced.
- 1280px: command center works as the main operational overview.
- 1440px: spacing remains professional and not crowded.
- 1920px: command center remains readable and does not feel overstretched.

Operator approval notes:

- Review the page after login as VitaPharma tenant admin.
- Refresh the command center once.
- Confirm no workflow action is triggered by the checklist.
- Confirm detailed workflow panels remain below the command center.

## Phase 14.4 executive operating summary and decision notes

Functional checks:

1. Confirm `Executive operating summary` appears inside the command center.
2. Confirm operating position, credit discipline, supplier exposure, and stock investment cards render.
3. Confirm `Decision notes` appears inside the command center.
4. Confirm approve daily position, collection follow-up, purchasing pressure, and manager handover notes render.
5. Confirm the executive summary is advisory only and does not submit, approve, mutate, or delete records.
6. Confirm the command center still refreshes from read-only tenant-safe reporting APIs.
7. Confirm Phase 14.1, Phase 14.2, and Phase 14.3 guardrail scripts still pass.

Executive approval checklist:

- The summary should help a manager understand cash, credit, supplier, and stock posture quickly.
- Decision notes should be practical and not look generic.
- The command center must remain operationally useful before detailed workflows.
- The feature must not introduce new backend, migration, dependency, or data mutation behavior.

## Phase 14.5 release closure and deployment evidence checklist

Release closure checks:

1. Confirm the command center includes the operations command center, operational alerts, review queues, operator checklist, executive summary, and decision notes.
2. Confirm all command center guardrail scripts pass.
3. Confirm the feature remains read-only and does not mutate sales, stock, receivables, payables, purchase orders, supplier invoices, or payments.
4. Confirm no backend, migration, dependency, or data mutation change was introduced in the release closure phase.
5. Confirm the release closure document is available for stakeholder, QA, and deployment review.

Deployment evidence checklist:

- branch reviewed from development before promotion
- local guardrails passed
- full Phase 0 check passed
- public website build passed
- admin dashboard build passed
- backend tests passed
- main promotion validated
- development final-sync validated
- final commit recorded

## Phase 14.6 production deployment runbook and post-deployment verification

Production readiness checks:

1. Confirm the production deployment runbook exists.
2. Confirm the runbook treats GitHub as the source of truth.
3. Confirm cPanel is treated as production runtime, not source control.
4. Confirm deployment instructions avoid destructive production commands.
5. Confirm post-deployment verification includes health, logs, authentication, dashboard, responsiveness, and read-only checks.
6. Confirm rollback evidence and deployment approval evidence are listed.
7. Confirm no backend, migration, dependency, frontend product, or data mutation change was introduced in this phase.

Post-deployment evidence checklist:

- final commit hash captured
- deployment date and responsible reviewer captured
- main branch confirmed as source
- backend health endpoint checked
- logs checked after deployment
- admin dashboard opened successfully
- PharmaCo360 command center opened successfully
- refresh action verified
- command center remains read-only
- 360px, 430px, 768px, 1280px, 1440px, and 1920px views reviewed

