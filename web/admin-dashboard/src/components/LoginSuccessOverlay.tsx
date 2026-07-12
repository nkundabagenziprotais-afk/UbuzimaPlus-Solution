import { useEffect } from 'react';

import type {
  LoginExperience,
} from '../lib/api';

type Props = {
  experience: LoginExperience;
  onClose: () => void;
};

export function LoginSuccessOverlay({
  experience,
  onClose,
}: Props) {
  useEffect(() => {
    const timer = window.setTimeout(
      onClose,
      3800,
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [onClose]);

  return (
    <div
      className="login-success-overlay"
      role="status"
      aria-live="polite"
    >
      <section className="login-success-card">
        <div
          className="login-success-orbit"
          aria-hidden="true"
        >
          <span />
          <i />
          <strong>✓</strong>
        </div>

        <p className="eyebrow">
          User Log-in Successful
        </p>

        <h2>
          {experience.title}{' '}
          <span>{experience.user_name}</span>
        </h2>

        <p>{experience.message}</p>

        <div className="login-success-security-line">
          <span>
            Secure authentication confirmed
          </span>

          {experience.trusted_device_used && (
            <small>
              Trusted device recognised
            </small>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
        >
          Enter workspace
        </button>
      </section>
    </div>
  );
}
