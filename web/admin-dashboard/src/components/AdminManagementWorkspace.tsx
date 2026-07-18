import {
  type ComponentProps,
  useMemo,
  useState,
} from 'react';

import type {
  AccessProfile,
} from '../lib/api';

import {
  PosSessionAdminControl,
} from './PosSessionAdminControl';

import {
  ProductMasterReconciliationWorkspace,
} from './ProductMasterReconciliationWorkspace';

import {
  UserSecurityManagement,
} from './UserSecurityManagement';

type UserSecurityProps =
  ComponentProps<typeof UserSecurityManagement>;

type AdminManagementWorkspaceKey =
  | 'overview'
  | 'users-security'
  | 'pos-session-admin'
  | 'product-master-reconciliation'
  | 'privilege-roadmap';

type Props = {
  token: string;
  tenantSlug: string;
  profile: AccessProfile;
  onVerified: UserSecurityProps['onVerified'];
};

type WorkspaceCard = {
  key: AdminManagementWorkspaceKey;
  title: string;
  description: string;
  status: string;
  permissionArea:
    | 'general'
    | 'security'
    | 'pos'
    | 'inventory';
};

const workspaceCards: WorkspaceCard[] = [
  {
    key: 'users-security',
    title: 'Users and Security',
    description:
      'Create and maintain staff accounts, login emails, roles, granular permissions, 2FA posture, password resets and session controls.',
    status: 'Operational',
    permissionArea: 'security',
  },
  {
    key: 'pos-session-admin',
    title: 'POS Session Admin Control',
    description:
      'Inspect cashier sessions, resolve stuck tills, force-close sessions and authorize controlled daily-session recovery.',
    status: 'Operational',
    permissionArea: 'pos',
  },
  {
    key: 'product-master-reconciliation',
    title: 'Product Master Reconciliation',
    description:
      'Review staged medicine catalogues, missing products, in-place corrections, duplicate proposals and payer-specific prices without breaking inventory history.',
    status: 'Controlled review',
    permissionArea: 'inventory',
  },
  {
    key: 'privilege-roadmap',
    title: 'Administrative Privilege Registry',
    description:
      'A governed home for future administrative capabilities, approval queues, audit controls and delegated support privileges.',
    status: 'Expandable',
    permissionArea: 'general',
  },
];

export function AdminManagementWorkspace({
  token,
  tenantSlug,
  profile,
  onVerified,
}: Props) {
  const [activeWorkspace, setActiveWorkspace] =
    useState<AdminManagementWorkspaceKey>('overview');

  const [sessionNotice, setSessionNotice] =
    useState('');

  const permissions = useMemo(
    () => new Set(profile.permissions ?? []),
    [profile.permissions],
  );

  const canManageSecurity = [
    'users.staff.view',
    'security.users.view',
    'security.roles.view',
    'security.permissions.view',
    'roles.manage',
    'tenant.roles.manage',
  ].some((permission) => permissions.has(permission));

  const canManagePosSessions = [
    'pharmaco.pos.sessions.manage',
    'pharmaco.pos.session.manage',
    'pharmaco.pos.session.admin',
    'pharmaco.pos.session.view',
    'pharmaco.pos.session.reset',
    'pharmaco.pos.admin',
    'pos.sessions.manage',
    'pos.session.manage',
    'pos.session.admin',
    'pos.session.view',
    'pos.session_support.view',
    'pos.session_support.edit',
    'roles.manage',
    'tenant.roles.manage',
    'tenant.admin',
    'tenant.users.manage',
    'platform.admin',
  ].some((permission) => permissions.has(permission));

  const canManageProductMaster =
    permissions.has('pharmaco.inventory.manage');

  function workspaceAvailable(
    area: WorkspaceCard['permissionArea'],
  ): boolean {
    if (area === 'security') {
      return canManageSecurity;
    }

    if (area === 'pos') {
      return canManagePosSessions;
    }

    if (area === 'inventory') {
      return canManageProductMaster;
    }

    return (
      canManageSecurity
      || canManagePosSessions
      || canManageProductMaster
    );
  }

  const activeTitle =
    workspaceCards.find(
      (workspace) => workspace.key === activeWorkspace,
    )?.title ?? 'Admin Management';

  return (
    <section className="admin-management-module">
      <header className="admin-management-header">
        <div>
          <span>Governed tenant administration</span>
          <h2>Admin Management</h2>
          <p>
            A controlled administrative workspace for user
            security, credential management, POS support,
            Product Master reconciliation, audit-ready privileges
            and future administrator capabilities.
          </p>
        </div>

        <div className="admin-management-context">
          <small>Active tenant</small>
          <strong>{tenantSlug}</strong>
          <span>{profile.user.name || profile.user.email}</span>
        </div>
      </header>

      <nav
        className="admin-management-navigation"
        aria-label="Admin Management workspaces"
      >
        <button
          type="button"
          className={
            activeWorkspace === 'overview'
              ? 'active'
              : ''
          }
          onClick={() => setActiveWorkspace('overview')}
        >
          Module overview
        </button>

        {workspaceCards.map((workspace) => {
          const available = workspaceAvailable(
            workspace.permissionArea,
          );

          return (
            <button
              key={workspace.key}
              type="button"
              className={
                activeWorkspace === workspace.key
                  ? 'active'
                  : ''
              }
              disabled={!available}
              title={
                available
                  ? workspace.description
                  : 'Your current role does not include this administrative privilege.'
              }
              onClick={() =>
                setActiveWorkspace(workspace.key)
              }
            >
              {workspace.title}
            </button>
          );
        })}
      </nav>

      {activeWorkspace === 'overview' && (
        <section className="admin-management-overview">
          <div className="admin-management-intro">
            <span>Administrator control room</span>
            <h3>Choose an administrative responsibility</h3>
            <p>
              Each workspace is permission-controlled. Sensitive
              actions remain tenant-scoped and should create an
              auditable administrative trail.
            </p>
          </div>

          <div className="admin-management-card-grid">
            {workspaceCards.map((workspace) => {
              const available = workspaceAvailable(
                workspace.permissionArea,
              );

              return (
                <article
                  key={workspace.key}
                  className={
                    available
                      ? 'admin-management-card'
                      : 'admin-management-card is-locked'
                  }
                >
                  <div>
                    <span>{workspace.status}</span>
                    <h3>{workspace.title}</h3>
                    <p>{workspace.description}</p>
                  </div>

                  <button
                    type="button"
                    disabled={!available}
                    onClick={() =>
                      setActiveWorkspace(workspace.key)
                    }
                  >
                    {available
                      ? 'Open workspace'
                      : 'Privilege required'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {activeWorkspace === 'users-security' && (
        <section
          className="admin-management-workspace"
          aria-label={activeTitle}
        >
          <UserSecurityManagement
            token={token}
            tenantSlug={tenantSlug}
            profile={profile}
            onVerified={onVerified}
          />
        </section>
      )}

      {activeWorkspace === 'pos-session-admin' && (
        <section
          className="admin-management-workspace"
          aria-label={activeTitle}
        >
          {sessionNotice && (
            <div className="admin-management-notice">
              {sessionNotice}
            </div>
          )}

          <PosSessionAdminControl
            token={token}
            tenantSlug={tenantSlug}
            permissions={profile.permissions ?? []}
            currentSession={null}
            onSessionChanged={(_session, message) => {
              setSessionNotice(message);
            }}
          />
        </section>
      )}

      {activeWorkspace
        === 'product-master-reconciliation' && (
        <section
          className="admin-management-workspace"
          aria-label={activeTitle}
        >
          <ProductMasterReconciliationWorkspace
            token={token}
            tenantSlug={tenantSlug}
          />
        </section>
      )}

      {activeWorkspace === 'privilege-roadmap' && (
        <section
          className="admin-management-roadmap"
          aria-label={activeTitle}
        >
          <header>
            <span>Future-ready governance</span>
            <h3>Administrative Privilege Registry</h3>
            <p>
              New administrative powers will be introduced here
              with explicit permission codes, approval rules,
              audit requirements and tenant boundaries.
            </p>
          </header>

          <div className="admin-management-roadmap-grid">
            <article>
              <strong>Access governance</strong>
              <p>
                Delegated roles, temporary privilege elevation,
                approval queues and periodic access review.
              </p>
            </article>

            <article>
              <strong>Operational support</strong>
              <p>
                Controlled correction tools, failed workflow
                recovery and support evidence without deleting
                business history.
              </p>
            </article>

            <article>
              <strong>Product Master governance</strong>
              <p>
                Source review, duplicate resolution, protected
                in-place corrections and human-approved product
                activation.
              </p>
            </article>

            <article>
              <strong>Audit and compliance</strong>
              <p>
                Actor, tenant, reason, before-and-after values,
                supporting evidence and review status.
              </p>
            </article>
          </div>
        </section>
      )}
    </section>
  );
}
