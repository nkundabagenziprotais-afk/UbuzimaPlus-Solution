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
