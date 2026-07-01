import { useEffect, useState } from 'react';
import {
  AccessProfile,
  TwoFactorSetupPayload,
  TwoFactorStatusResponse,
  getTwoFactorStatus,
  regenerateRecoveryCodes,
  revokeTrustedDevice,
  startTwoFactorSetup,
  verifyTwoFactor,
} from '../lib/api';

type TwoFactorAdminPanelProps = {
  token: string;
  profile: AccessProfile;
  onVerified: (token: string, profile: AccessProfile, trustedDeviceToken?: string) => void;
};

export function TwoFactorAdminPanel({ token, profile, onVerified }: TwoFactorAdminPanelProps) {
  const [status, setStatus] = useState<TwoFactorStatusResponse | null>(null);
  const [setup, setSetup] = useState<{ challenge_token: string; setup: TwoFactorSetupPayload } | null>(null);
  const [code, setCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void loadStatus();
  }, [token]);

  async function loadStatus() {
    setIsLoading(true);
    setError('');

    try {
      setStatus(await getTwoFactorStatus(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load two-factor status.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleStartSetup() {
    setIsLoading(true);
    setError('');
    setMessage('');
    setRecoveryCodes(null);

    try {
      const response = await startTwoFactorSetup(token);
      setSetup({ challenge_token: response.challenge_token, setup: response.setup });
      setMessage('Scan the QR code or enter the manual key, then confirm the 6-digit authenticator code.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start two-factor setup.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerifySetup() {
    if (!setup) return;

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await verifyTwoFactor({
        challenge_token: setup.challenge_token,
        code,
        trust_device: trustDevice,
        device_name: 'Ubuzima+ Admin Dashboard',
      });

      setRecoveryCodes(response.recovery_codes);
      setSetup(null);
      setCode('');
      setMessage('Two-factor authentication is active for this staff account.');
      onVerified(response.access_token, response.profile, response.trusted_device?.trusted_device_token);
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to verify authenticator code.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegenerateRecoveryCodes() {
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await regenerateRecoveryCodes(token);
      setRecoveryCodes(response.recovery_codes);
      setMessage('Recovery codes regenerated. Keep them somewhere secure.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to regenerate recovery codes.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRevokeDevice(deviceId: number) {
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await revokeTrustedDevice(token, deviceId);
      setMessage('Trusted device revoked.');
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to revoke trusted device.');
    } finally {
      setIsLoading(false);
    }
  }

  const twoFactor = status?.two_factor;

  return (
    <article className="panel wide two-factor-admin-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Staff two-factor authentication</h2>
          <p className="muted">
            Staff access is protected with authenticator app codes. Trusted devices can skip the prompt
            until the trust period expires or an admin revokes the device.
          </p>
        </div>

        <button type="button" onClick={handleStartSetup} disabled={isLoading}>
          {twoFactor?.enabled ? 'Reset authenticator' : 'Set up authenticator'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <section className="security-status-grid">
        <div>
          <span>Account</span>
          <strong>{profile.user.email}</strong>
        </div>
        <div>
          <span>Mandatory</span>
          <strong>{twoFactor?.required ? 'Yes' : 'No'}</strong>
        </div>
        <div>
          <span>Authenticator</span>
          <strong>{twoFactor?.enabled ? 'Enabled' : 'Not enabled'}</strong>
        </div>
        <div>
          <span>Trusted devices</span>
          <strong>{twoFactor?.trusted_devices.length ?? 0}</strong>
        </div>
      </section>

      {setup && (
        <section className="two-factor-setup-grid">
          <div className="qr-card">
            <div dangerouslySetInnerHTML={{ __html: setup.setup.qr_svg }} />
            <span>Scan with an authenticator app</span>
          </div>

          <div className="two-factor-form-card">
            <h3>Manual setup</h3>
            <p className="muted">Use this text key if image scanning is unavailable.</p>
            <code>{setup.setup.manual_secret}</code>

            <label>
              6-digit authenticator code
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
              />
            </label>

            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={trustDevice}
                onChange={(event) => setTrustDevice(event.target.checked)}
              />
              Trust this device after verification
            </label>

            <button type="button" onClick={handleVerifySetup} disabled={isLoading || code.trim().length < 6}>
              Verify and activate
            </button>
          </div>
        </section>
      )}

      {recoveryCodes && (
        <section className="recovery-code-panel">
          <h3>Recovery codes</h3>
          <p className="muted">These codes are shown once. Store them securely for emergency access.</p>
          <div>
            {recoveryCodes.map((item) => (
              <code key={item}>{item}</code>
            ))}
          </div>
        </section>
      )}

      <section className="trusted-device-panel">
        <div className="section-heading-row">
          <div>
            <h3>Trusted devices</h3>
            <p className="muted">
              Device trust lasts {twoFactor?.trusted_device_days ?? 30} days and can be revoked immediately.
            </p>
          </div>
          {twoFactor?.enabled && (
            <button type="button" onClick={handleRegenerateRecoveryCodes} disabled={isLoading}>
              Regenerate recovery codes
            </button>
          )}
        </div>

        {twoFactor?.trusted_devices.length ? (
          <div className="trusted-device-list">
            {twoFactor.trusted_devices.map((device) => (
              <div key={device.id}>
                <strong>{device.device_name ?? 'Trusted device'}</strong>
                <span>{device.ip_address ?? 'IP not recorded'}</span>
                <small>Trusted until {device.trusted_until ?? 'unknown'}</small>
                <button type="button" onClick={() => handleRevokeDevice(device.id)} disabled={isLoading}>
                  Revoke
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No trusted devices are active for this account.</p>
        )}
      </section>
    </article>
  );
}
