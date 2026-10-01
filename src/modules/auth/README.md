# Auth

Sessions: sign in, refresh, devices and two-factor. The largest module, because
the interesting parts of session handling are not the password check.

```text
auth
├── auth.controller.ts     routes
├── auth.service.ts        register, login, token issuing
├── refresh-token.service.ts  rotation, revocation, theft detection
├── device.service.ts      device fingerprinting and revocation
├── two-factor.service.ts   TOTP setup, verification, recovery codes
├── strategies/            jwt.strategy.ts
├── dto/                   one per request shape
├── entities/              refresh_token, user_device, two_factor_secret
├── enums/                 refresh token revoked reason
└── types/                 payload and metadata interfaces
```

## Token pair

`POST /auth/login` returns a short lived access token and a rotating refresh
token. The access token is stateless; everything that must be revocable lives on
the refresh token row.

## Rotation is the security property

Rotation happens inside a transaction with a pessimistic row lock, so two
concurrent refreshes of the same token produce exactly one winner. The loser gets
a clear failure rather than a second session.

The rotated-out token keeps a `replacedById` pointer, which forms the chain.

**Replaying a token that was revoked by rotation is treated as theft**: all
sessions of that user are revoked. Someone holding a stolen token is not going to
be the only person using it, and invalidating everything is the response that
actually helps. A token revoked by an explicit `POST /auth/logout` does **not**
trigger that sweep, because logging out is not a compromise signal.

## Devices

A device is fingerprinted by user agent, so repeated logins from the same
browser reuse one `user_devices` row instead of creating duplicates. Logging in
again from a revoked device reactivates it rather than failing.

Each `refresh_tokens` row carries a `deviceId`, and rotation keeps the token on
its original device. A session therefore cannot hop to another device while
refreshing, which is what makes `DELETE /auth/devices/:id` meaningful: it
deactivates the device and revokes every token attached to it.

`@DeviceName()` derives a friendly name from the `user-agent` header so clients
send nothing; an explicit `x-device-name` overrides it. Both are untrusted, so the
decorator trims, collapses whitespace and caps the length.

## Two-factor

Optional, and off entirely with `TWO_FACTOR_ENABLED=false`.

- The shared secret is never stored in the clear. It is encrypted with
  AES-256-GCM using `TWO_FACTOR_ENCRYPTION_KEY`, and the auth tag is verified on
  read, so a tampered row fails loudly. Rotating the key invalidates every stored
  secret.
- `POST /auth/2fa/setup` issues a secret but does not enable 2FA.
  `POST /auth/2fa/verify` confirms it, and only then enables 2FA and returns the
  recovery codes, shown once.
- Recovery codes are Crockford base32, stored as salted hashes, and removed from
  the list as they are spent, so the array doubles as the set still usable.
- `POST /auth/login` returns HTTP 200 with a short lived challenge token instead
  of a token pair when 2FA is on. `POST /auth/2fa/login` exchanges the challenge
  plus a code for the real pair.
- TOTP steps are single use. The last accepted counter is persisted, so replaying
  a code inside its own 30 second window is rejected.
- Five invalid attempts locks verification for 15 minutes.

## Rate limits

`@Throttle` tightens the global limit on the routes that accept a secret, because
100 per minute is no defence at all against password guessing.

| Route                            | Limit                                      |
| -------------------------------- | ------------------------------------------ |
| `POST /auth/login`               | 5 / min                                    |
| `POST /auth/2fa/login`           | 5 / 5 min                                  |
| `POST /auth/2fa/verify`          | 5 / 5 min                                  |
| `POST /auth/register`            | 10 / 5 min                                 |
| `POST /auth/refresh-token`       | 20 / min                                   |
| `POST /auth/forgot-password`     | 3 / hour per address, 10 / hour per client |
| `POST /auth/resend-verification` | 3 / hour per address, 10 / hour per client |
| `POST /auth/verify-email`        | 10 / hour                                  |

Counters are per process, so with several replicas the effective limit is the
number above **times the replica count**.

## Account enumeration

`forgot-password` and `resend-verification` answer the same way, take the same
time, and do the same database work whether or not the address is registered.

| Defence                                                                             | Why                                                                             |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| One message for every outcome, including an already verified or deactivated account | A different message is an oracle that needs no analysis to read                 |
| The miss path runs the same `UPDATE` against an id with no rows                     | Fewer statements means a faster response, and speed is a signal                 |
| Both paths are held for `TIMING_FLOOR_MS`, with the same jitter on both             | Jittering only the fast path would separate the branches in the other direction |
| No mail is sent on the miss path                                                    | A caller cannot check the promise except by the absence of mail                 |

**The floor is a mitigation, not a proof.** It only holds while the real branch
stays under it. If issuing a token ever takes longer than `TIMING_FLOOR_MS`, that
branch becomes the slow one and the padding equalises nothing.
`enumeration.spec.ts` asserts both branches are held for the floor, which is the
assertion that actually pins it: the difference assertion alone passes even with
the padding removed, because the gap it measures is small.

## Auth state is not cached

`JwtStrategy` reads `isActive`, `role` and `isManager` on every request, on
purpose. Caching it would mean a deactivated account or a role change stayed in
effect for the length of the TTL, which is the wrong trade for this field.
