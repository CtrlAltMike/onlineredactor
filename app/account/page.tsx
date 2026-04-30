import { AccountClient } from './account-client';

export const metadata = {
  title: 'Account — OnlineRedactor',
  description: 'Manage your OnlineRedactor account without document storage.',
};

export default function AccountPage() {
  return <AccountClient />;
}
