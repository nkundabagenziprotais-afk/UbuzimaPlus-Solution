<?php

namespace App\Services\Auth;

use App\Models\TrustedDevice;
use App\Models\TwoFactorChallenge;
use App\Models\User;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TwoFactorAuthenticationService
{
    private const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public function staffTwoFactorRequired(User $user): bool
    {
        return (bool) config('auth.two_factor.staff_required', true)
            && (bool) $user->two_factor_required;
    }

    public function createSetupChallenge(User $user, Request $request): array
    {
        $secret = $this->generateSecret();
        $challenge = $this->createChallenge($user, 'setup', $request, $secret);

        return [
            'challenge_token' => $challenge['plain_token'],
            'expires_at' => $challenge['record']->expires_at?->toISOString(),
            'setup' => $this->setupPayload($user, $secret),
        ];
    }

    public function createLoginChallenge(User $user, Request $request): array
    {
        $challenge = $this->createChallenge($user, 'login', $request);

        return [
            'challenge_token' => $challenge['plain_token'],
            'expires_at' => $challenge['record']->expires_at?->toISOString(),
        ];
    }

    public function setupPayload(User $user, string $secret): array
    {
        $otpauthUri = $this->otpauthUri($user, $secret);

        return [
            'type' => 'totp',
            'issuer' => 'Ubuzima Plus',
            'account' => $user->email,
            'manual_secret' => $secret,
            'otpauth_uri' => $otpauthUri,
            'qr_svg' => $this->qrSvg($otpauthUri),
        ];
    }

    public function findChallenge(string $plainToken): ?TwoFactorChallenge
    {
        return TwoFactorChallenge::query()
            ->with('user')
            ->where('challenge_token_hash', $this->hashToken($plainToken))
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->first();
    }

    public function verifySetupChallenge(TwoFactorChallenge $challenge, string $code): bool
    {
        if ($challenge->purpose !== 'setup' || ! $challenge->setup_secret) {
            return false;
        }

        return $this->verifyTotp($challenge->setup_secret, $code);
    }

    public function verifyLoginChallenge(TwoFactorChallenge $challenge, string $code): bool
    {
        $user = $challenge->user;

        if ($challenge->purpose !== 'login' || ! $user?->two_factor_secret) {
            return false;
        }

        if ($this->verifyTotp($user->two_factor_secret, $code)) {
            return true;
        }

        return $this->consumeRecoveryCode($user, $code);
    }

    public function enableForUser(User $user, string $secret): array
    {
        $recoveryCodes = $this->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_required' => true,
            'two_factor_enabled' => true,
            'two_factor_secret' => $secret,
            'two_factor_recovery_codes' => array_map(fn (string $code) => $this->hashRecoveryCode($code), $recoveryCodes),
            'two_factor_confirmed_at' => now(),
            'two_factor_last_verified_at' => now(),
        ])->save();

        return $recoveryCodes;
    }

    public function markVerified(User $user): void
    {
        $user->forceFill([
            'two_factor_last_verified_at' => now(),
        ])->save();
    }

    public function markChallengeUsed(TwoFactorChallenge $challenge): void
    {
        $challenge->forceFill([
            'used_at' => now(),
        ])->save();
    }

    public function createTrustedDevice(User $user, Request $request, ?string $deviceName = null): array
    {
        $plainToken = Str::random(80);
        $trustedUntil = now()->addDays((int) config('auth.two_factor.trusted_device_days', 30));

        TrustedDevice::query()->create([
            'user_id' => $user->id,
            'device_token_hash' => $this->hashToken($plainToken),
            'device_name' => $deviceName ?: $request->input('device_name', 'Trusted staff device'),
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 191, ''),
            'trusted_until' => $trustedUntil,
            'last_used_at' => now(),
        ]);

        return [
            'trusted_device_token' => $plainToken,
            'trusted_until' => $trustedUntil->toISOString(),
        ];
    }

    public function trustedDeviceIsValid(User $user, ?string $plainToken): bool
    {
        if (! $plainToken) {
            return false;
        }

        $trustedDevice = TrustedDevice::query()
            ->where('user_id', $user->id)
            ->where('device_token_hash', $this->hashToken($plainToken))
            ->whereNull('revoked_at')
            ->where('trusted_until', '>', now())
            ->first();

        if (! $trustedDevice) {
            return false;
        }

        $trustedDevice->forceFill([
            'last_used_at' => now(),
        ])->save();

        return true;
    }

    public function generateSecret(int $bytes = 20): string
    {
        return $this->base32Encode(random_bytes($bytes));
    }

    public function currentCode(string $secret): string
    {
        return $this->totpAt($secret, time());
    }

    public function verifyTotp(string $secret, string $code, int $window = 1): bool
    {
        $normalized = preg_replace('/\s+/', '', $code);

        if (! is_string($normalized) || ! preg_match('/^\d{6}$/', $normalized)) {
            return false;
        }

        $now = time();

        for ($offset = -$window; $offset <= $window; $offset++) {
            if (hash_equals($this->totpAt($secret, $now + ($offset * 30)), $normalized)) {
                return true;
            }
        }

        return false;
    }

    private function createChallenge(User $user, string $purpose, Request $request, ?string $setupSecret = null): array
    {
        $plainToken = Str::random(64);
        $expiresAt = now()->addMinutes((int) config('auth.two_factor.challenge_minutes', 10));

        $record = TwoFactorChallenge::query()->create([
            'user_id' => $user->id,
            'challenge_token_hash' => $this->hashToken($plainToken),
            'purpose' => $purpose,
            'setup_secret' => $setupSecret,
            'device_name' => $request->input('device_name'),
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 191, ''),
            'expires_at' => $expiresAt,
        ]);

        return [
            'plain_token' => $plainToken,
            'record' => $record,
        ];
    }

    private function otpauthUri(User $user, string $secret): string
    {
        $issuer = 'Ubuzima Plus';
        $label = rawurlencode($issuer . ':' . $user->email);

        return sprintf(
            'otpauth://totp/%s?secret=%s&issuer=%s&algorithm=SHA1&digits=6&period=30',
            $label,
            $secret,
            rawurlencode($issuer)
        );
    }

    private function qrSvg(string $content): string
    {
        $renderer = new ImageRenderer(
            new RendererStyle(220),
            new SvgImageBackEnd()
        );

        return (new Writer($renderer))->writeString($content);
    }

    private function totpAt(string $secret, int $timestamp): string
    {
        $counter = intdiv($timestamp, 30);
        $key = $this->base32Decode($secret);
        $binaryCounter = pack('N*', 0) . pack('N*', $counter);
        $hash = hash_hmac('sha1', $binaryCounter, $key, true);
        $offset = ord(substr($hash, -1)) & 0x0F;
        $truncated = unpack('N', substr($hash, $offset, 4))[1] & 0x7FFFFFFF;

        return str_pad((string) ($truncated % 1000000), 6, '0', STR_PAD_LEFT);
    }

    private function generateRecoveryCodes(): array
    {
        return collect(range(1, 10))
            ->map(fn () => strtoupper(Str::random(5) . '-' . Str::random(5)))
            ->all();
    }

    private function consumeRecoveryCode(User $user, string $code): bool
    {
        $hash = $this->hashRecoveryCode($code);
        $storedCodes = $user->two_factor_recovery_codes ?? [];

        foreach ($storedCodes as $index => $storedHash) {
            if (hash_equals((string) $storedHash, $hash)) {
                unset($storedCodes[$index]);
                $user->forceFill([
                    'two_factor_recovery_codes' => array_values($storedCodes),
                    'two_factor_last_verified_at' => now(),
                ])->save();

                return true;
            }
        }

        return false;
    }

    private function hashToken(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }

    private function hashRecoveryCode(string $code): string
    {
        return hash('sha256', strtoupper(str_replace(' ', '', trim($code))));
    }

    private function base32Encode(string $bytes): string
    {
        $bits = '';

        foreach (str_split($bytes) as $byte) {
            $bits .= str_pad(decbin(ord($byte)), 8, '0', STR_PAD_LEFT);
        }

        $secret = '';

        foreach (str_split($bits, 5) as $chunk) {
            $secret .= self::BASE32_ALPHABET[bindec(str_pad($chunk, 5, '0', STR_PAD_RIGHT))];
        }

        return $secret;
    }

    private function base32Decode(string $secret): string
    {
        $clean = strtoupper(preg_replace('/[^A-Z2-7]/', '', $secret) ?? '');
        $bits = '';

        foreach (str_split($clean) as $character) {
            $position = strpos(self::BASE32_ALPHABET, $character);

            if ($position === false) {
                continue;
            }

            $bits .= str_pad(decbin($position), 5, '0', STR_PAD_LEFT);
        }

        $bytes = '';

        foreach (str_split($bits, 8) as $chunk) {
            if (strlen($chunk) === 8) {
                $bytes .= chr(bindec($chunk));
            }
        }

        return $bytes;
    }
}
