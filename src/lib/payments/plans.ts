// Pricing and entitlements for the paid tier. Adjust PRO_PLAN_PRICE_NGN in
// .env to change the price without a code change; the limits below are code
// because they change less often and affect enforcement logic elsewhere.
export const PRO_PLAN = {
  id: "pro",
  name: "Pro",
  priceNgn: Number(process.env.PRO_PLAN_PRICE_NGN?.trim() || 5000),
  monthlyUploadLimit: 500,
  monthlyProposalLimit: 100,
  durationDays: 30,
} as const;

// Matches the Subscription model's @default values (starter's own
// limits already live there and in src/server/usage.ts's fallback
// constants) - kept here too since the expiry-downgrade logic needs a
// single, explicit target to revert to.
export const STARTER_PLAN = {
  id: "starter",
  monthlyUploadLimit: 100,
  monthlyProposalLimit: 10,
} as const;
