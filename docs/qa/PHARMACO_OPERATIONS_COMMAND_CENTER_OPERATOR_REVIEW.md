# PharmaCo360 Operations Command Center Operator Review

## Purpose

This checklist helps a pharmacy manager review the command center before approving it for staging, demo, or production deployment.

The command center remains read-only. It summarizes existing tenant-safe reporting data and does not mutate sales, stock, receivables, payables, suppliers, invoices, purchase orders, or payments.

## Review flow

1. Log in as the VitaPharma tenant admin.
2. Confirm the command center appears before detailed workflow panels.
3. Click `Refresh command center`.
4. Confirm the stock at cost, sales generated, customer credit risk, and supplier balance KPIs are readable.
5. Confirm operational alerts are visible.
6. Confirm review queues are visible.
7. Confirm the operator review checklist is visible.
8. Confirm detailed workflow modules remain available below the command center.
9. Confirm no destructive or approval action is triggered by the command center.

## Screen-size review

- 360px: no horizontal overflow; cards stack cleanly.
- 430px: refresh button is tappable and text is readable.
- 768px: two-column sections remain balanced.
- 1280px: command center leads the dashboard clearly.
- 1440px: spacing feels professional and not crowded.
- 1920px: content remains readable and controlled.

## Approval decision

Approve only when the command center is readable, operationally useful, tenant-safe, and clearly read-only.
