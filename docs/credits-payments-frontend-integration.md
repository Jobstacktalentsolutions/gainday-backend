# Unlock credits: frontend integration guide

Employers buy one-off credit packs and spend 1 credit per candidate unlock. The backend is a
ledger (`credit_ledger_entries`): the balance is always the sum of the employer's entries.
All endpoints below are employer-only (JWT cookie/bearer as for the rest of the API).

## Setup

- Packages already installed: `@stripe/stripe-js`, `@stripe/react-stripe-js`.
- Env: `VITE_STRIPE_PUBLISHABLE_KEY` (frontend). Backend needs `STRIPE_SECRET_KEY` and
  `STRIPE_WEBHOOK_SECRET`.
- Local webhooks: `stripe listen --forward-to localhost:3000/payments/webhook`.

### Why embedded Checkout, not a custom Elements form

The payment step uses Stripe's **embedded Checkout** (a `checkout.session` with
`ui_mode: 'embedded_page'`), not a hand-built `<PaymentElement>` form. Stripe owns the whole
payment UI and its state machine — card entry, validation, retries, 3D Secure — so there's far
less custom code on our side to get wrong, and it keeps the same lighter PCI posture (SAQ A) as a
hosted Checkout page while still rendering inline in our modal, with no redirect away from the
candidate review page.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/payments/packs` | Pack catalogue: `[{ id, name, pricePence, credits, label }]` (Starter, Growth, Scale) |
| GET | `/payments/balance` | `{ balance }` credits available. Show next to the shortlist |
| POST | `/payments/unlock` | Body `{ submissionIds: string[] }`. Spend credits |
| POST | `/payments/purchases` | Body `{ packId }`. Returns `{ purchaseId, clientSecret }` |
| GET | `/payments/purchases/:id` | `{ status: 'PENDING' \| 'SUCCEEDED' \| 'FAILED', ... }` |

`POST /payments/webhook` is Stripe-only; the frontend never calls it.

### `POST /payments/unlock`

- 201 `{ unlockedSubmissionIds, creditsUsed, balance }`. Already-unlocked candidates cost nothing
  (`creditsUsed` can be 0). The candidate is emailed asking them to send their CV to the employer.
- 402 when the balance can't cover the new unlocks. Nothing is spent. Body:
  `{ balance, needed, shortfall, recommendedPackId, message }`. Open the pack modal with
  `recommendedPackId` preselected (the smallest pack covering `shortfall`).
  If `shortfall` exceeds the largest pack (12) the largest pack is recommended; after that purchase
  call unlock again and you may get another 402 for the remainder.
- 404 if any id is unknown, 403 if any belongs to another employer's job.

## "Pay and unlock" flow (employer never leaves the page)

1. Employer clicks Unlock (one or many). Call `POST /payments/unlock`.
2. 201 -> done: refetch the submission(s) and balance. Contact details are now returned.
3. 402 -> open the modal: show the 3 packs from `/payments/packs`, preselect `recommendedPackId`.
4. "Pay and unlock": `POST /payments/purchases { packId }` -> `{ clientSecret }`. Mount embedded
   Checkout in the modal:
   ```tsx
   const stripe = await loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
   <EmbeddedCheckoutProvider stripe={stripe} options={{ clientSecret }}>
     <EmbeddedCheckout />
   </EmbeddedCheckoutProvider>
   ```
   Checkout handles card entry, validation and 3D Secure itself inside that iframe — nothing
   else to build. Card payments complete without leaving the modal; a redirect-based method
   (rare for this flow) would bounce through `appUrl + '/employer/payments/return'`, a route
   that doesn't exist yet — add a trivial one ("you can close this tab") only if you enable
   non-card payment methods, otherwise it's unused.
5. Credits are granted by the Stripe webhook, not by the browser, once the session actually
   completes. Poll `GET /payments/purchases/:purchaseId` (e.g. every 1s, give up after ~30s)
   until `status === 'SUCCEEDED'`. `FAILED` -> show the error and let them retry (covers a
   declined card or an abandoned/expired session).
6. Call `POST /payments/unlock` again with the same `submissionIds`. Close the modal and refetch.

If the browser closes between 5 and 6 the credits are still on the account; the employer just
unlocks again, free of any further payment.

## Submission responses changed

`GET /submissions/job/:jobId` and `GET /submissions/:id` (employer views) now:

- no longer include `candidate` at all (candidates are anonymous while locked);
- include `isUnlocked: boolean`;
- include `contact: { fullName, email, phoneNumber: string | null } | null` — non-null only when
  `isUnlocked` is true.

`PUT /submissions/:id/unlock`, `GET /payments/quote` and `POST /payments/checkout` were removed.
`submissions.isUnlocked` no longer exists as a column; it is derived from the ledger.

## Frontend work to do

- Replace mocks in `features/employer/hooks/useEmployerSubmission.ts` and align
  `features/employer/types/submission.ts` with the real shape above (verify against a live
  response, don't assume field names for the parts of the submission this doc doesn't cover).
- `SubmissionDetail.tsx`: implement `handleUnlockContact` per the flow above.
- Submission table: row checkboxes + "Unlock these profiles" (one `POST /payments/unlock` with all ids).
- Balance beside the shortlist (`GET /payments/balance`).
- `EmployerCandidate.tsx` (unlocked candidates list): there is no "list my unlocked candidates"
  endpoint yet; add one when that page is built.

## Open points for the client

Refunds, VAT and invoicing aren't in the spec (it jumps from section 3 to 7). The ledger entry type
enum can be extended (REFUND / ADJUSTMENT) when they're defined.
