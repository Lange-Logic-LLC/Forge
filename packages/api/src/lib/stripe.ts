import Stripe from 'stripe';
import { PLANS, type PlanName } from '@forge/shared';

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

export function getPlanFromPriceId(priceId: string): PlanName {
  for (const [name, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) return name as PlanName;
  }
  return 'starter';
}

export function getPlanConfig(plan: PlanName) {
  return PLANS[plan] ?? PLANS.starter;
}
