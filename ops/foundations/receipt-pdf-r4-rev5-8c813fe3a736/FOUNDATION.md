# Ubuzima+ Receipt PDF R4 Rev5 Safe Foundation

This directory freezes the approved receipt/PDF foundation.

## Approved behavior

- Receipt action: **Download only**
- Hard Copy Print: removed
- Hard Copy PDF: removed
- WhatsApp PDF: removed
- Email PDF: removed
- Downloaded artifact: application/pdf
- Sale-reference filename retained
- One serial number per product
- Long Product Names wrap
- POS Cart Product Names wrap without changing cart calculations
- Receipt Layer 2A.4 preserved
- Cart/payment capture preserved
- Adapter V5 preserved

## Locked TEST runtime

TEST tree SHA-256:

`7e0762405d1166c65f2af813e9c25d8b844be9fcc55fb4e2482af0d8ac58a246`

## Protected components

- `receipt-content-layer2a4-391ea34d65c3.js`
  - SHA-256: `391ea34d65c3200c7ecb294c58efbdb73e1874cd99c08741ee9bb1c4a2617bb1`

- `receipt-cart-payment-v2-6a501be43ac7.js`
  - SHA-256: `6a501be43ac7e3f2d86b6d2cc4450e12241958db723d0e3ff9bc5d928aa99454`

- `receipt-action-adapter-v5-b5c342bd540c.js`
  - SHA-256: `b5c342bd540c8f348aafa03d70f4a61413508e8637bbdb914ebd67d8be46ecda`

- `receipt-pdf-delivery-v1-r4-rev5-8c813fe3a736.js`
  - SHA-256: `8c813fe3a7366904350bb4cca919c29efbe6e99abb93643756a06c8c07e10ecc`

## Production

This foundation does not modify or authorize production.

Production baseline:

`d993944252b38d005bf828c16d4f36c5ec95794777775e2ce3e776639d38e35b`

## Database

The TEST database is intentionally excluded.

Transaction data is mutable operational data and is not part of this source-code foundation.

## GitHub

Foundation branch:

`feature/ubuzima-receipt-r4-rev5-foundation-8c813fe3a736`

Foundation tag:

`ubuzima-receipt-r4-rev5-safe-foundation-8c813fe3a736`

Future receipt work should explicitly branch from or reference this foundation.
