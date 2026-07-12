import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getSecurityOperations,
  runSecurityUserAction,
  type SecurityOperationsResponse,
  type SecurityOperationsUser,
  type SecurityRiskLevel,
  type SecurityUserAction,
} from '../lib/api';

type Props = {
  token: string;
  tenantSlug: string;
  onMutated?: () => void;
};

type PendingAction = {
  user: SecurityOperationsUser;
  action: SecurityUserAction;
  label: string;
  status?: string;
} | null;

function dateLabel(
  value: string | null,
): string {
  if (!value) {
    return 'Never';
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? 'Not available'
    : parsed.toLocaleString();
}

function riskLabel(
  risk: SecurityRiskLevel,
): string {
  if (risk === 'high') {
    return 'Action required';
  }

  if (risk === 'medium') {
    return 'Review';
  }

  if (risk === 'blocked') {
    return 'Access blocked';
  }

  return 'Healthy';
}

export function SecurityOperationsCentre({
  token,
  tenantSlug,
  onMutated,
}: Props) {
  const [data, setData] =
    useState<SecurityOperationsResponse | null>(
      null,
    );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] =
    useState('all');

  const [riskFilter, setRiskFilter] =
    useState('all');

  const [expandedUserId, setExpandedUserId] =
    useState<number | null>(null);

  const [pendingAction, setPendingAction] =
    useState<PendingAction>(null);

  const [reason, setReason] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] =
    useState(true);

  const [isActing, setIsActing] =
    useState(false);

  async function loadOperations() {
    setIsLoading(true);
    setError('');

    try {
      const response =
        await getSecurityOperations(
          token,
          tenantSlug,
        );

      setData(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load security operations.',
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadOperations();
  }, [token, tenantSlug]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch =
      search.trim().toLowerCase();

    return (data?.users ?? []).filter(
      (user) => {
        const matchesSearch =
          !normalizedSearch ||
          [
            user.name,
            user.email,
            user.phone ?? '',
            user.job_title ?? '',
            user.branch?.name ?? '',
            ...user.roles.map(
              (role) => role.name,
            ),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch);

        const matchesStatus =
          statusFilter === 'all' ||
          user.status === statusFilter;

        const matchesRisk =
          riskFilter === 'all' ||
          user.security.risk_level
            === riskFilter;

        return (
          matchesSearch &&
          matchesStatus &&
          matchesRisk
        );
      },
    );
  }, [
    data,
    riskFilter,
    search,
    statusFilter,
  ]);

  function queueAction(
    user: SecurityOperationsUser,
    action: SecurityUserAction,
    label: string,
    status?: string,
  ) {
    setReason('');
    setNotice('');
    setError('');
    setPendingAction({
      user,
      action,
      label,
      status,
    });
  }

  async function confirmAction() {
    if (!pendingAction) {
      return;
    }

    setIsActing(true);
    setError('');
    setNotice('');

    try {
      const response =
        await runSecurityUserAction(
          token,
          tenantSlug,
          pendingAction.user.id,
          pendingAction.action,
          {
            status:
              pendingAction.status,
            reason:
              reason.trim() || undefined,
          },
        );

      setNotice(response.message);
      setPendingAction(null);
      setReason('');

      await loadOperations();
      onMutated?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Security action failed.',
      );
    } finally {
      setIsActing(false);
    }
  }

  const summary = data?.summary;

  const summaryCards = [
    {
      label: 'Total Users',
      value: summary?.total_users ?? 0,
      detail:
        `${summary?.active_users ?? 0} active`,
    },
    {
      label: '2FA Compliance',
      value:
        `${summary
          ?.two_factor_compliance_percent
          ?? 0}%`,
      detail:
        `${summary?.two_factor_pending ?? 0} pending enrolment`,
    },
    {
      label: 'Active Sessions',
      value: summary?.active_sessions ?? 0,
      detail:
        `${summary?.trusted_devices ?? 0} trusted devices`,
    },
    {
      label: 'Action Required',
      value: summary?.high_risk_users ?? 0,
      detail:
        `${summary
          ?.password_change_required
          ?? 0} password changes`,
    },
    {
      label: 'Never Logged In',
      value: summary?.never_logged_in ?? 0,
      detail:
        `${summary?.invited_users ?? 0} invited`,
    },
    {
      label: 'Restricted Access',
      value:
        (summary?.suspended_users ?? 0)
        + (summary?.inactive_users ?? 0),
      detail:
        `${summary?.suspended_users ?? 0} suspended`,
    },
  ];

  return (
    <section className="security-operations-centre">
      <header className="security-operations-hero">
        <div>
          <p className="eyebrow">
            One Platform, One Customer
          </p>

          <h2>
            User &amp; Security Operations
            Centre
          </h2>

          <span>
            Control user identity, access,
            two-factor authentication,
            trusted devices, sessions, and
            account readiness from one
            operational workspace.
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            void loadOperations()
          }
          disabled={isLoading}
        >
          {isLoading
            ? 'Refreshing…'
            : 'Refresh security'}
        </button>
      </header>

      {notice && (
        <div className="notice success">
          {notice}
        </div>
      )}

      {error && (
        <div className="notice error">
          {error}
        </div>
      )}

      <div className="security-operations-scorecard">
        {summaryCards.map((card) => (
          <article key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.detail}</small>
          </article>
        ))}
      </div>

      <section className="security-operations-toolbar">
        <label>
          Search users
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Name, email, role, branch…"
          />
        </label>

        <label>
          Account status
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
          >
            <option value="all">
              All statuses
            </option>
            <option value="active">
              Active
            </option>
            <option value="invited">
              Invited
            </option>
            <option value="suspended">
              Suspended
            </option>
            <option value="inactive">
              Inactive
            </option>
          </select>
        </label>

        <label>
          Security risk
          <select
            value={riskFilter}
            onChange={(event) =>
              setRiskFilter(
                event.target.value,
              )
            }
          >
            <option value="all">
              All risk levels
            </option>
            <option value="high">
              Action required
            </option>
            <option value="medium">
              Review
            </option>
            <option value="low">
              Healthy
            </option>
            <option value="blocked">
              Access blocked
            </option>
          </select>
        </label>
      </section>

      {isLoading && !data ? (
        <div className="security-operations-state">
          Loading security operations…
        </div>
      ) : (
        <div className="security-operations-table-shell">
          <table className="security-operations-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Account</th>
                <th>Security posture</th>
                <th>Sessions</th>
                <th>Last login</th>
                <th>Controls</th>
              </tr>
            </thead>

            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    No users match the current
                    security filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <>
                    <tr key={user.id}>
                      <td>
                        <strong>{user.name}</strong>
                        <span>{user.email}</span>
                        <small>
                          {user.job_title
                            ?? 'No job title'}
                        </small>
                      </td>

                      <td>
                        <span
                          className={
                            `security-account-status is-${user.status}`
                          }
                        >
                          {user.status}
                        </span>

                        <small>
                          {user.branch?.name
                            ?? 'All branches'}
                        </small>
                      </td>

                      <td>
                        <span
                          className={
                            `security-risk-badge is-${user.security.risk_level}`
                          }
                        >
                          {riskLabel(
                            user.security
                              .risk_level,
                          )}
                        </span>

                        <small>
                          {user.security
                            .two_factor_enabled
                            ? '2FA enabled'
                            : user.security
                                .two_factor_required
                              ? '2FA pending'
                              : '2FA optional'}
                        </small>

                        {user.security
                          .must_change_password && (
                          <small>
                            Password change required
                          </small>
                        )}
                      </td>

                      <td>
                        <strong>
                          {user.security
                            .active_sessions_count}
                        </strong>
                        <span>
                          session(s)
                        </span>
                        <small>
                          {user.security
                            .trusted_devices_count}
                          {' '}trusted device(s)
                        </small>
                      </td>

                      <td>
                        <span>
                          {dateLabel(
                            user.security
                              .last_login_at,
                          )}
                        </span>
                      </td>

                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedUserId(
                              (current) =>
                                current === user.id
                                  ? null
                                  : user.id,
                            )
                          }
                        >
                          {expandedUserId
                            === user.id
                            ? 'Close controls'
                            : 'Security controls'}
                        </button>
                      </td>
                    </tr>

                    {expandedUserId
                      === user.id && (
                      <tr
                        key={
                          `${user.id}-controls`
                        }
                        className="security-operations-control-row"
                      >
                        <td colSpan={6}>
                          <section className="security-user-control-panel">
                            <div className="security-user-control-summary">
                              <div>
                                <span>
                                  Roles
                                </span>
                                <strong>
                                  {user.roles
                                    .map(
                                      (role) =>
                                        role.name,
                                    )
                                    .join(', ')
                                    || 'No active role'}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Trusted devices
                                </span>
                                <strong>
                                  {user
                                    .trusted_devices
                                    .length}
                                </strong>
                              </div>

                              <div>
                                <span>
                                  Active sessions
                                </span>
                                <strong>
                                  {user.sessions
                                    .length}
                                </strong>
                              </div>
                            </div>

                            <div className="security-user-control-actions">
                              <button
                                type="button"
                                onClick={() =>
                                  queueAction(
                                    user,
                                    'force-password-change',
                                    'Force password change',
                                  )
                                }
                              >
                                Force password change
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  queueAction(
                                    user,
                                    'reset-two-factor',
                                    'Reset two-factor authentication',
                                  )
                                }
                              >
                                Reset 2FA
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  queueAction(
                                    user,
                                    'revoke-trusted-devices',
                                    'Revoke trusted devices',
                                  )
                                }
                              >
                                Revoke devices
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  queueAction(
                                    user,
                                    'revoke-sessions',
                                    'Revoke active sessions',
                                  )
                                }
                              >
                                Revoke sessions
                              </button>

                              {user.status !==
                                'active' && (
                                <button
                                  type="button"
                                  className="is-positive"
                                  onClick={() =>
                                    queueAction(
                                      user,
                                      'status',
                                      'Activate tenant access',
                                      'active',
                                    )
                                  }
                                >
                                  Activate access
                                </button>
                              )}

                              {user.status ===
                                'active' && (
                                <button
                                  type="button"
                                  className="is-warning"
                                  onClick={() =>
                                    queueAction(
                                      user,
                                      'status',
                                      'Suspend tenant access',
                                      'suspended',
                                    )
                                  }
                                >
                                  Suspend access
                                </button>
                              )}

                              {user.status !==
                                'inactive' && (
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() =>
                                    queueAction(
                                      user,
                                      'status',
                                      'Deactivate tenant access',
                                      'inactive',
                                    )
                                  }
                                >
                                  Deactivate
                                </button>
                              )}
                            </div>
                          </section>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {pendingAction && (
        <div
          className="security-action-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={
            pendingAction.label
          }
        >
          <section className="security-action-dialog">
            <p className="eyebrow">
              Sensitive security action
            </p>

            <h3>
              {pendingAction.label}
            </h3>

            <p>
              Apply this action to{' '}
              <strong>
                {pendingAction.user.name}
              </strong>
              {' '}({pendingAction.user.email})?
            </p>

            <label>
              Administrative reason
              <textarea
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target.value,
                  )
                }
                rows={3}
                maxLength={500}
                placeholder="Optional reason for the audit trail"
              />
            </label>

            <div>
              <button
                type="button"
                disabled={isActing}
                onClick={() =>
                  void confirmAction()
                }
              >
                {isActing
                  ? 'Applying…'
                  : 'Confirm action'}
              </button>

              <button
                type="button"
                disabled={isActing}
                onClick={() =>
                  setPendingAction(null)
                }
              >
                Cancel
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
