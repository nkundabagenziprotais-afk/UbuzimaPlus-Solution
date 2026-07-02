# Phase I Platform-Wide Dashboard Amendment Ledger

Source: Improvement on Ubuzima Plus Vr.1.docx

## Global UI/UX Rules

- Apply changes across the whole platform, including Platform Admin, Solution Admin, Tenant Admin, and any equivalent module views.
- Use left-side tree menu with default folding style.
- Avoid long-page module layouts.
- Display one page per selected menu item.
- Remove duplicated page headers or repeated hero sections.
- Keep titles and numbers bold where needed, but keep explanatory content normal-weight.
- Reduce crowded information areas.
- Allow future admin-controlled styling: font size, color, dashboard theme, and selected visible home-page cards.
- Replace generic information cards with real operational analytics, alerts, charts, graphs, or tables.
- Every module section requiring list data should support:
  - 15 default rows for full-page tables
  - limited preview rows on dashboard cards
  - View more / See more
  - Bulk Edit where relevant
  - Export where relevant
  - Bulk Delete where relevant and permission-controlled
- Include section-level export where detailed information is available.
- Maintain tenant scoping, RBAC, and data separation.

## 1. Home Page

- Remove the duplicate section above the main header because it repeats the head.
- Keep titles and numbers in bold; keep descriptive text normal.
- Reduce overcrowded home-page information.
- Add future option for admin/user to choose which home cards remain visible.
- Improve Operating Dashboard field so it changes based on the active menu.
- Keep Operating Dashboard at login/home only.
- Add unread badge to Corporate Email.
- Improve font size.
- Add future admin-controlled styling: size, colors, fonts.

## 2. Inventory

Tree menu:
- Inventory Overview
- Low Stock Watch List
- Retail Product Shelf
- Batch and Expiry Preview
- Near Expiry Watch List
- Product Master
- Stock Locations

Rules:
- Use page-per-page layout.
- Replace non-useful section with AI Inventory Analytics using charts and graphs.
- Retail Product Shelf:
  - clear section title
  - preview with 2 rows and current 5-column style
  - See more for full page
- Batch and Expiry Preview:
  - placed after Retail Product Shelf
  - 5 default preview rows
  - View more to full page
  - full page supports Bulk Edit, Export, Bulk Delete
- Near Expiry Watch List:
  - placed after Batch and Expiry Preview
  - 5 default preview rows
  - View more to full page
  - full page supports Bulk Edit, Export, Bulk Delete
- Product Master and Stock Receiving Actions:
  - top 4 action cards:
    - Create New Product
    - Edit Product
    - Receive Stock
    - Bulk Tools
  - below cards: summary table of products
  - 15 default rows
  - View more to full page
  - full page supports Bulk Edit, Export, Bulk Delete
  - selected card opens relevant page
- Stock Locations comes after Product Master.

## 3. POS and Sales

Tree menu:
- POS and Sales Overview
- POS
- Dispensing Review
- Customers and Patients
- Prescriptions
- Sales Performance
- Payment and Receipt

Rules:
- Rename Fast product search/cart/customer/prescription/draft sale section to POS.
- Improve dispensing review cards.
- POS insurance:
  - customer contribution percentage
  - insurance/partner percentage
  - percentages fetched from insurance/partners configuration.
- Product Browser:
  - allow Grid and List views
  - Grid view: 2 columns x 5 rows
- Sale Cart:
  - improve fit and presentation
  - include transaction summary before commit:
    - customer contribution
    - insurance/partner institution amount
    - tax
    - total
- Receipt:
  - generate PDF receipt
  - physical printer option
  - Bluetooth printer readiness
  - WhatsApp option
  - Email option through Corporate Email with attachment
- Customer invoice capture:
  - should not be standalone form
  - only appears during checkout when customer requests invoice.
- Prescription capture:
  - Product Master must indicate products requiring prescription.
  - If prescription-required product selected, system prompts prescription capture.
  - Camera opens to capture prescription.
  - AI text extraction fills required fields where possible.
  - If handwriting unclear, attach image/document and allow manual capture.
  - Returning customers can retrieve previous prescription/customer information and edit if needed.
  - Sale Cart continues after prescription step.
- Customers and Patients:
  - starts with summary cards
  - table with 15 rows default
  - View more to full page
  - full page supports Bulk Edit, Export, Bulk Delete
- Prescriptions:
  - starts with summary cards
  - table with 15 rows default
  - View more to full page
  - full page supports Bulk Edit, Export, Bulk Delete
- Sales Performance:
  - two-section layout
  - right section: performance table
  - 15 rows default
  - View more to full page
  - full page supports Bulk Edit, Export, Bulk Delete
  - second section: improved Selected Sale Detail summary
- Payment and Receipt:
  - two-section layout
  - right section: payment/receipt table
  - 15 rows default
  - View more to full page
  - full page supports Bulk Edit, Export, Bulk Delete
  - second section: improved Selected Sale Detail summary

## 4. Supplier

Tree menu:
- Supplier Overview
- Create Supplier
- Supplier List
- Create Purchase Order
- Outstanding Purchase Order List
- Receive Purchase Order
- Received Purchase Order List

Rules:
- Supplier List:
  - two-section layout
  - table with 15 rows default
  - View more to full page
  - full page supports Bulk Edit, Export, Bulk Delete
  - selected detail summary improved
- Outstanding Purchase Order List:
  - two-section layout
  - table with 15 rows default
  - View more to full page
  - full page supports Bulk Edit, Export, Bulk Delete
  - selected PO detail summary improved
- Received Purchase Order List:
  - two-section layout
  - table with 15 rows default
  - View more to full page
  - full page supports Bulk Edit, Export, Bulk Delete
  - selected received PO detail summary improved

## 5. Finance

Tree menu:
- Finance Overview
- Finance Flow
- Exception Focus
- Customer Credits and Receivables
- Receivable Register
- Collection
- Financial Statement

Rules:
- Improve Finance Overview card view.
- Improve Finance Flow presentation.
- Improve Exception Focus presentation.
- Customer Credits and Receivables:
  - overview summary with charts and graphs
  - card for Create Customer Credits
  - card for Create Customer Receivables
- Receivable Register:
  - two-section layout
  - table with 15 rows default
  - View more to full page
  - full page supports Bulk Edit and Export
  - selected detail summary improved
- Collection:
  - two-section layout
  - table with 15 rows default
  - View more to full page
  - full page supports Bulk Edit and Export
  - selected detail summary improved
- Financial Statement AI:
  - AI-assisted generation
  - manual refresh for real-time information
  - Trial Balance
  - General Ledger
  - Cash Flow Statement
  - Income Statement
  - Balance Sheet
  - Bank Reconciliation
  - MoMo Reconciliation
  - Cash Reconciliation

## 6. Ad-hoc Report

Rename Reports to Ad-hoc Report.

Tree menu:
- Ad-hoc Report Overview
- Operation Alerts
- Review Queues
- Executive Operating Summary
- Decision Note
- Operation Checklist
- Priority Follow-up and Manager Review Notes

Rules:
- Overview shows today’s operating picture using charts and graphs.
- Replace static information cards with real data alerts.
- Operation Alerts must use real alerts.
- Executive Operating Summary must use real operating data.
- Decision Note must use real data context.
- Operation Checklist must use real operational checks.
- Priority Follow-up and Manager Review Notes must support manager action.

## 7. Operations 360 View

- Rename/position former PharmaCo360 Operating View as Operations 360 View.
- Improve module presentation.
- Every section must include:
  - link to detailed information
  - export option where relevant.

## 8. Pharmacist Chats

Tree/menu:
- In-app Chat
- WhatsApp Message Chats

Rules:
- Support in-app pharmacist chats.
- Support WhatsApp message chat view.
- Future integration should use company WhatsApp number and customer-linked chat history.

## 9. AI Center

Rename AI Recommendations to AI Center.

Tree/menu:
- AI Governance
- Operational AI Center
- AI Provider Management
- AI Model Registry
- AI Agent Management
- AI Prompt Library
- AI Knowledge Base
- AI Data Connectors
- AI Recommendations
- AI Workflow Automations
- AI Human Approval Center
- AI Feedback and Learning
- AI Usage, Cost and Quota Control
- AI Risk and Compliance
- AI Audit Logs
- Recommendation Approval Queue
- AI Insight Dashboard
- Chat Me AI

Operational AI Center cards:
- Business Chat
- Customer Retention
- Demand Forecast
- Expiry Risk
- Finance Forecast
- Fraud and Anomaly
- Pricing and Margin
- Reorder Recommendation
- Stock-out
- Supplier Performance
- Inventory Assistance
- Operations Copilot

Rules:
- Use cards for Operational AI Center for easier navigation.
- Each card should show summary information.
- Clicking a card opens the model operation workspace.
- Include Chat Me AI for platform guidance, tutorials, and ease of use.
- Models should be operationally navigable without complexity.

## 10. Admin

Tree/menu:
- User Profiles
- Create New User
- Edit User
- Delete User
- Deactivate User
- 2FA
- Website Management

2FA sub-items:
- Self 2FA
- User 2FA Management
  - Reset
  - Activate
  - Deactivate

Rules:
- Improve user profile presentation.
- Website Management should allow admins to manage website content according to privilege level.
- Super Admin controls privilege availability.

## 11. Notifications

Tree/menu:
- Notification Overview
- Create New Notification
- Manage Recurring Notifications
- Platform Notification Management Center

Recurring notification actions:
- Edit
- Disable

Rules:
- Improve presentation.
- Support platform notification management center.

## Removed Sections

- Remove repeated generic information strip/section across pages.
- Keep related information elsewhere, not as repeated page clutter.

## QA Acceptance

- No long-page module view remains for these modules.
- Left menu tree controls selected page.
- All renamed modules are reflected in menu and page titles.
- All preview tables respect preview limits.
- Full pages support required bulk and export actions.
- No demo/default credential shortcuts.
- No `.local` user data in deployed frontend.
- Build passes.
- Auth tests pass.
- Deployment verified on `/admin/` and API login endpoints.
