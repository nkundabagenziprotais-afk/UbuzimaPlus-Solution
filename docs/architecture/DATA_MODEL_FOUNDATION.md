# Data Model Foundation

## Platform-Level Entities

- users
- roles
- permissions
- admin_scopes
- tenants
- tenant_users
- solutions
- solution_admins
- modules
- solution_modules
- tenant_module_activations
- branches
- entity_configurations
- visibility_policies
- audit_logs
- support_access_requests
- support_access_sessions

## AI Center Entities

- ai_providers
- ai_models
- ai_agents
- ai_agent_permissions
- ai_knowledge_sources
- ai_knowledge_documents
- ai_prompts
- ai_tasks
- ai_recommendations
- ai_recommendation_actions
- ai_feedback
- ai_usage_logs
- ai_cost_logs
- ai_approval_rules
- ai_audit_logs

## PharmaCo360 Entities

- pharmacy_profiles
- pharmacy_branches
- product_categories
- products
- drug_master
- product_batches
- inventory_stocks
- stock_movements
- stock_adjustments
- stock_transfers
- suppliers
- supplier_products
- purchase_requests
- purchase_orders
- goods_received_notes
- sales
- sale_items
- payments
- receipts
- customers
- prescriptions
- prescription_items
- wholesale_catalogs
- wholesale_orders
- wholesale_order_items
- deliveries
- insurance_partners
- insurance_claims
- clinic_partners

## Tenant-Owned Table Rule

Tenant-owned tables must include:

- tenant_id
- created_by
- updated_by
- created_at
- updated_at
- deleted_at where needed

Branch-level tables must also include:

- branch_id
