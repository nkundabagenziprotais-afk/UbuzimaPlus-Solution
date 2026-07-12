import {
  useMemo,
  useState,
  type ComponentProps,
} from 'react';

import type {
  AccessProfile,
} from '../lib/api';

import {
  UserAccessWorkspace,
} from './UserAccessWorkspace';

import {
  SecurityOperationsCentre,
} from './SecurityOperationsCentre';

import {
  RoleGovernancePanel,
} from './RoleGovernancePanel';

import {
  SecurityAuditTimeline,
} from './SecurityAuditTimeline';

import {
  TwoFactorAdminPanel,
} from './TwoFactorAdminPanel';

type UserSecurityWorkspace =
  | 'home'
  | 'users'
  | 'two-factor'
  | 'operations'
  | 'roles'
  | 'audit';

type UserAccessWorkspaceProps =
  ComponentProps<typeof UserAccessWorkspace>;

type RuntimeProps = {
  token: string;
  tenantSlug: string;
  profile: AccessProfile;
  onVerified: (
    token: string,
    profile: AccessProfile,
    trustedDeviceToken?: string,
  ) => void;
};

type WorkspaceDefinition = {
  id: UserSecurityWorkspace;
  label: string;
  shortLabel: string;
  description: string;
  outcome: string;
  sequence: string;
};

const workspaceDefinitions:
  WorkspaceDefinition[] = [
    {
      id: 'users',
      label: 'Users & Access',
      shortLabel: 'Users',
      description:
        'Manage people, tenant access, branches, roles and account status from one controlled register.',
      outcome:
        'Create, review and maintain user access.',
      sequence: '01',
    },
    {
      id: 'two-factor',
      label: 'Staff 2FA',
      shortLabel: '2FA',
      description:
        'Set up staff authenticators, review enforcement, protect recovery codes and control trusted devices.',
      outcome:
        'Protect staff accounts with verified second-factor access.',
      sequence: '02',
    },
    {
      id: 'operations',
      label: 'Security Operations',
      shortLabel: 'Operations',
      description:
        'Act on password, session, trusted-device and account-risk controls.',
      outcome:
        'Resolve security risks and pending actions.',
      sequence: '03',
    },
    {
      id: 'roles',
      label: 'Roles & Permissions',
      shortLabel: 'Roles',
      description:
        'Design managed and tenant-specific roles with permission and segregation-of-duties controls.',
      outcome:
        'Govern access before permissions are assigned.',
      sequence: '04',
    },
    {
      id: 'audit',
      label: 'Audit & Sessions',
      shortLabel: 'Audit',
      description:
        'Review security activity, role changes, actors, targets, dates and access evidence.',
      outcome:
        'Investigate and export security evidence.',
      sequence: '05',
    },
  ];

function ModuleHome({
  onOpen,
}: {
  onOpen:
    (workspace: UserSecurityWorkspace) => void;
}) {
  return (
    <section
      className="user-security-module-home"
      aria-labelledby="user-security-title"
    >
      <header className="user-security-home-intro user-security-home-intro--approved">
        <div className="user-security-home-title-group">
          <p className="user-security-kicker">
            Administration · Access · Protection
          </p>

          <h1 id="user-security-title">
            User &amp; Security
          </h1>

          <p>
            Control staff access, two-factor
            protection, permissions and security
            evidence from one governed module.
          </p>
        </div>

        <div className="user-security-home-header-actions">
          <span className="user-security-header-badge">
            Tenant protected
          </span>

          <strong>
            Five focused workspaces
          </strong>

          <small>
            Select a workspace below to continue.
          </small>
        </div>
      </header>

      <div className="user-security-home-section-heading">
        <div>
          <span>Workspaces</span>
          <h2>
            Choose the security task to perform
          </h2>
        </div>

        <p>
          Each workspace is intentionally
          separated to keep actions focused,
          reviewable and safe.
        </p>
      </div>

      <div className="user-security-home-grid">
        {workspaceDefinitions.map(
          (workspace) => (
            <button
              type="button"
              key={workspace.id}
              className="user-security-home-card user-security-home-card--title-only"
              aria-label={`Open ${workspace.label}`}
              onClick={() =>
                onOpen(workspace.id)
              }
            >
              <span className="user-security-home-card-index">
                {workspace.sequence}
              </span>

              <h3>{workspace.label}</h3>

              <span
                className="user-security-home-card-arrow"
                aria-hidden="true"
              >
                →
              </span>
            </button>
          ),
        )}
      </div>


    </section>
  );
}

export function UserSecurityManagement(
  props: UserAccessWorkspaceProps
    & RuntimeProps,
) {
  const {
    token,
    tenantSlug,
    profile,
    onVerified,
  } = props;

  const [workspace, setWorkspace] =
    useState<UserSecurityWorkspace>('home');

  const [refreshKey, setRefreshKey] =
    useState(0);

  const activeDefinition = useMemo(
    () =>
      workspaceDefinitions.find(
        (item) =>
          item.id === workspace,
      ),
    [workspace],
  );

  function openWorkspace(
    target: UserSecurityWorkspace,
  ) {
    setWorkspace(target);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  return (
    <section
      className="user-security-module-shell"
      data-workspace={workspace}
    >
      {/* USER_SECURITY_APPROVED_MODULE_REFOUNDATION */}

      <header className="user-security-module-navigation">
        <div className="user-security-navigation-context">
          <button
            type="button"
            className="user-security-navigation-brand"
            onClick={() =>
              openWorkspace('home')
            }
          >
            <span>U+</span>

            <div>
              <strong>User &amp; Security</strong>
              <small>
                {activeDefinition?.label
                  ?? 'Module Home'}
              </small>
            </div>
          </button>

          <nav
            aria-label="User and security workspaces"
          >
            <button
              type="button"
              className={
                workspace === 'home'
                  ? 'is-active'
                  : ''
              }
              aria-current={
                workspace === 'home'
                  ? 'page'
                  : undefined
              }
              onClick={() =>
                openWorkspace('home')
              }
            >
              Home
            </button>

            {workspaceDefinitions.map(
              (item) => (
                <button
                  type="button"
                  key={item.id}
                  className={
                    workspace === item.id
                      ? 'is-active'
                      : ''
                  }
                  aria-current={
                    workspace === item.id
                      ? 'page'
                      : undefined
                  }
                  onClick={() =>
                    openWorkspace(item.id)
                  }
                >
                  <span className="desktop-label">
                    {item.label}
                  </span>

                  <span className="mobile-label">
                    {item.shortLabel}
                  </span>
                </button>
              ),
            )}
          </nav>
        </div>

        <button
          type="button"
          className="user-security-exit-button"
          onClick={() => {
            window.location.assign('/admin/');
          }}
        >
          Main Dashboard
        </button>
      </header>

      {workspace !== 'home' && (
        <section className="user-security-workspace-heading">
          <div>
            <button
              type="button"
              onClick={() =>
                openWorkspace('home')
              }
            >
              ← User &amp; Security Home
            </button>

            <span>
              {activeDefinition?.sequence}
              {' / '}
              Security workspace
            </span>

            <h1>
              {activeDefinition?.label}
            </h1>

            <p>
              {activeDefinition?.description}
            </p>
          </div>

          <aside>
            <span>Expected outcome</span>
            <strong>
              {activeDefinition?.outcome}
            </strong>
          </aside>
        </section>
      )}

      <main className="user-security-module-content">
        {workspace === 'home' && (
          <ModuleHome
            onOpen={openWorkspace}
          />
        )}

        {workspace === 'users' && (
          <section className="user-security-focused-workspace">
            <UserAccessWorkspace
              key={refreshKey}
              token={token}
              tenantSlug={tenantSlug}
            />
          </section>
        )}

        {workspace === 'two-factor' && (
          <section className="user-security-focused-workspace staff-two-factor-workspace">
            {/* STAFF_TWO_FACTOR_FIRST_CLASS_WORKSPACE */}
            <TwoFactorAdminPanel
              token={token}
              profile={profile}
              onVerified={onVerified}
            />
          </section>
        )}

        {workspace === 'operations' && (
          <section className="user-security-focused-workspace">
            <SecurityOperationsCentre
              token={token}
              tenantSlug={tenantSlug}
              onMutated={() => {
                setRefreshKey(
                  (current) =>
                    current + 1,
                );
              }}
            />
          </section>
        )}

        {workspace === 'roles' && (
          <section className="user-security-focused-workspace">
            <RoleGovernancePanel
              token={token}
              tenantSlug={tenantSlug}
            />
          </section>
        )}

        {workspace === 'audit' && (
          <section className="user-security-focused-workspace">
            <SecurityAuditTimeline
              token={token}
              tenantSlug={tenantSlug}
            />
          </section>
        )}
      </main>
    </section>
  );
}
