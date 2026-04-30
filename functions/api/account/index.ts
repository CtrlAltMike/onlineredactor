import {
  deleteAccount,
  getAccount,
  type AccountEnv,
} from '../../../lib/cloudflare/account-api';

type AccountContext = { request: Request; env: AccountEnv };

export const onRequestGet = ({ request, env }: AccountContext) =>
  getAccount(request, env);

export const onRequestDelete = ({ request, env }: AccountContext) =>
  deleteAccount(request, env);
