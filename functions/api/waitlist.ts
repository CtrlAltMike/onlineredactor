import {
  joinWaitlist,
  type AccountEnv,
} from '../../lib/cloudflare/account-api';

type AccountContext = { request: Request; env: AccountEnv };

export const onRequestPost = ({ request, env }: AccountContext) =>
  joinWaitlist(request, env);
