import {
  verifyMagicLink,
  type AccountEnv,
} from '../../../lib/cloudflare/account-api';

type AccountContext = { request: Request; env: AccountEnv };

export const onRequestGet = ({ request, env }: AccountContext) =>
  verifyMagicLink(request, env);
