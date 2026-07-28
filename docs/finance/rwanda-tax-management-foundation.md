# Rwanda Shared Tax Management Foundation

## Purpose

Provide one effective-dated and auditable tax engine for:

- Pharmacy POS and dispensing
- Product Master
- Procurement and supplier invoices
- Customer and insurance receivables
- Finance and statutory reporting
- Import and excise management
- HR and payroll in later phases

## Product classification dimensions

The existing `products.product_category_id` remains the therapeutic
or legacy category.

The new `products.business_category_id` represents the commercial and
tax-oriented category used during Product Master onboarding.

Business categories use `product_categories.category_type=business_tax`.

Initial business categories:

- Essential Medicine
- Other Human Medicine
- OTC and Consumer Health
- Oral and Dental Care
- Medical Device and Diagnostic
- Medical Consumable
- Cosmetics and Beauty
- Nutrition and Supplements
- Personal Care and Hygiene
- Mother and Baby Care
- Sanitary and Feminine Care
- General Merchandise
- Unclassified — Review Required

## Tax treatments

Tax treatments are distinct:

- STANDARD_RATE
- EXEMPT
- ZERO_RATED
- OUT_OF_SCOPE
- REVIEW_REQUIRED

An Essential Medicine category does not itself grant VAT exemption.

Exemption requires:

1. Matching an active approved RRA exemption-list item; or
2. An authorised manual ruling with supporting evidence.

## Effective-dated rates

Administrators create a new tax-rate version with:

- Effective-from date
- Optional effective-to date
- Legal reference
- Source document hash
- Approval record

Existing transactions retain immutable calculation snapshots.

## Cosmetics excise

Cosmetics excise evaluation requires:

- Product business category
- HS code
- Transaction context
- Importer or manufacturer context
- Applicable effective-dated excise rule

The POS must not blindly add excise to an item where excise was already
accounted for at import or manufacturing stage.

## RRA exemption registry

Every imported official list stores:

- Publication and effective dates
- Source URL
- SHA-256 checksum
- Version label
- Approval status
- Original row payload
- Normalised searchable fields
- Aliases
- Import and review history

Fuzzy matches produce candidates only.

Final exemption requires an approved match.

## RRA integration readiness

`tax_integration_endpoints` and `tax_sync_runs` support future:

- RRA API authentication
- Exemption-list synchronisation
- Tax-rate synchronisation
- EBM integration
- Retry and reconciliation monitoring

Credentials must be referenced through protected secret storage and
must not be stored directly in repository files.

## Configuration governance

Tax types, profiles, rates and rules are not physically deleted after use.

Historical configuration is protected through restrictive foreign keys,
effective dates, version numbers, approval records and immutable transaction
snapshots.

Application services must reject overlapping active effective periods for the
same tax configuration scope.

A new rate or rule must be created as a new version. Existing transaction
snapshots must never be recalculated because an administrator changes a future
or current tax rate.

Product tax assignments use tenant, product and version as their historical
identity. Review and approval are separate actions.

## Exemption-list authority

The registry separately records:

- Issuing authority
- Approving authority
- Publishing authority

This distinction allows the application to preserve the legal and publication
chain of each imported exemption-list edition.
