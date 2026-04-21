export const PLANS = {
  starter: {
    name: 'Starter',
    priceId: null,
    buildsLimit: 25,
    concurrentLimit: 1,
    artifactTtlDays: 7,
    monthlyPrice: 0,
  },
  pro: {
    name: 'Pro',
    priceId: null, // set via env STRIPE_PRO_PRICE_ID
    buildsLimit: 200,
    concurrentLimit: 3,
    artifactTtlDays: 30,
    monthlyPrice: 29,
  },
  team: {
    name: 'Team',
    priceId: null, // set via env STRIPE_TEAM_PRICE_ID
    buildsLimit: 1000,
    concurrentLimit: 10,
    artifactTtlDays: 90,
    monthlyPrice: 99,
  },
  enterprise: {
    name: 'Enterprise',
    priceId: null,
    buildsLimit: Infinity,
    concurrentLimit: 50,
    artifactTtlDays: 365,
    monthlyPrice: null,
  },
} as const;

export type PlanName = keyof typeof PLANS;
