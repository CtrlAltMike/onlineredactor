import {
  handleStripeWebhook,
  type StripeEnv,
} from '../../../lib/cloudflare/stripe-api';

type StripeContext = { request: Request; env: StripeEnv };

export const onRequestPost = ({ request, env }: StripeContext) =>
  handleStripeWebhook(request, env);
