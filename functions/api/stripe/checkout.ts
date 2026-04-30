import {
  createCheckoutSession,
  type StripeEnv,
} from '../../../lib/cloudflare/stripe-api';

type StripeContext = { request: Request; env: StripeEnv };

export const onRequestPost = ({ request, env }: StripeContext) =>
  createCheckoutSession(request, env);
