/* USERS_ACCESS_BRANCH_ASSIGNMENT_PANEL_V1 */
import {
  useMemo,
  useEffect, useState,
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


type UserBranchAssignmentBranch = {
  id: number;
  name: string;
  code?: string | null;
  status?: string | null;
};

type UserBranchAssignmentUser = {
  id: number;
  name: string;
  email: string;
  status?: string | null;
  branch_id?: number | null;
  branch?: {
    id: number;
    name: string;
    code?: string | null;
  } | null;
};

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


function UserBranchAssignmentPanel({
  token,
  tenantSlug,
  refreshKey,
  onChanged,
}: {
  token: string;
  tenantSlug: string;
  refreshKey: number;
  onChanged: () => void;
}) {
  const [users, setUsers] = useState<UserBranchAssignmentUser[]>([]);
  const [branches, setBranches] = useState<UserBranchAssignmentBranch[]>([]);
  const [message, setMessage] = useState('');
  const [savingUserId, setSavingUserId] = useState<number | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadBranchAssignments() {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Tenant': tenantSlug,
        'X-Tenant-Slug': tenantSlug,
      };

      try {
        const [usersResponse, branchesResponse] = await Promise.all([
          fetch('/api/v1/access-check/security/users', { headers }),
          fetch('/api/v1/pharmaco/branches', { headers }),
        ]);

        if (!usersResponse.ok || !branchesResponse.ok) {
          return;
        }

        const usersPayload = await usersResponse.json() as {
          users?: UserBranchAssignmentUser[];
        };

        const branchesPayload = await branchesResponse.json() as {
          branches?: UserBranchAssignmentBranch[];
        };

        if (!isActive) {
          return;
        }

        setUsers(usersPayload.users ?? []);
        setBranches(
          (branchesPayload.branches ?? []).filter((branch) =>
            String(branch.status ?? 'active').toLowerCase() === 'active',
          ),
        );
      } catch {
        if (isActive) {
          setMessage('Unable to load users or branches.');
        }
      }
    }

    loadBranchAssignments();

    return () => {
      isActive = false;
    };
  }, [token, tenantSlug, refreshKey]);

  async function assignBranch(userId: number, branchId: string) {
    setSavingUserId(userId);
    setMessage('');

    try {
      const response = await fetch(`/api/v1/access-check/security/users/${userId}/branch`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Tenant': tenantSlug,
          'X-Tenant-Slug': tenantSlug,
        },
        body: JSON.stringify({
          branch_id: branchId ? Number(branchId) : null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Branch assignment failed: ${response.status}`);
      }

      const data = await response.json() as {
        user?: UserBranchAssignmentUser;
        message?: string;
      };

      setUsers((current) =>
        current.map((user) =>
          user.id === userId
            ? {
                ...user,
                branch_id: data.user?.branch_id ?? (branchId ? Number(branchId) : null),
                branch: data.user?.branch ?? branches.find((branch) => String(branch.id) === branchId) ?? null,
              }
            : user,
        ),
      );

      setMessage(data.message ?? 'Branch assignment updated.');
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update branch assignment.');
    } finally {
      setSavingUserId(null);
    }
  }

  return (
    <section className="user-branch-assignment-panel">
      {/* USERS_ACCESS_BRANCH_ASSIGNMENT_PANEL_V1 */}
      <header>
        <div>
          <span>Branch assignment</span>
          <h3>Assign users to operating branches</h3>
        </div>
        <p>
          This assignment is saved to the user tenant profile and is used by Historical POS, Live POS and branch-scoped workflows.
        </p>
      </header>

      {message ? (
        <div className="form-success">
          {message}
        </div>
      ) : null}

      <div className="user-branch-assignment-list">
        {users.map((user) => {
          const selectedBranchId = String(user.branch_id ?? user.branch?.id ?? '');

          return (
            <article key={user.id} className="user-branch-assignment-row">
              <div>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>

              <label>
                <span>Assigned branch</span>
                <select
                  value={selectedBranchId}
                  disabled={savingUserId === user.id}
                  onChange={(event) => assignBranch(user.id, event.target.value)}
                >
                  <option value="">No branch selected</option>
                  {branches.map((branch) => (
                    <option key={branch.id} value={String(branch.id)}>
                      {branch.name}{branch.code ? ` (${branch.code})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </article>
          );
        })}

        {users.length === 0 ? (
          <p className="muted">No users found for this tenant.</p>
        ) : null}
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

              <UserBranchAssignmentPanel
                token={token}
                tenantSlug={tenantSlug}
                refreshKey={refreshKey}
                onChanged={() => {
                  setRefreshKey((current) => current + 1);
                }}
              />
              {/* USERS_ACCESS_BRANCH_ASSIGNMENT_PANEL_V1_RENDER */}

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
