import { execFileSync } from 'node:child_process';

const smokeUrl = process.env.LAUNCH_SMOKE_URL || '';

run('npm', ['run', 'lint']);
run('npm', ['test']);
run('npm', ['run', 'build']);
run('npm', ['run', 'fixtures']);
run('npm', ['run', 'e2e']);
run('npx', ['wrangler', 'd1', 'migrations', 'list', 'onlineredactor-prod', '--remote']);
run('gh', [
  'repo',
  'view',
  'CtrlAltMike/onlineredactor',
  '--json',
  'isPrivate',
  '--jq',
  '.isPrivate == false',
]);

if (smokeUrl) {
  curl(`${smokeUrl}/api/account`, [401]);
  curl(`${smokeUrl}/api/waitlist`, [200], 'POST', {
    email: `launch-smoke-${Date.now()}@example.com`,
    source: 'launch-check',
  });
  curl(`${smokeUrl}/api/stripe/checkout`, [401], 'POST');
  curl(`${smokeUrl}/api/stripe/webhook`, [400, 503], 'POST', {}, { 'Stripe-Signature': 't=1,v1=bad' });
}

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { stdio: 'inherit' });
}

function curl(url, expectedStatuses, method = 'GET', body, headers = {}) {
  const args = ['-sS', '-o', '/dev/null', '-w', '%{http_code}', '-X', method, url];
  for (const [key, value] of Object.entries({
    'content-type': 'application/json',
    ...headers,
  })) {
    args.push('-H', `${key}: ${value}`);
  }
  if (body) args.push('--data', JSON.stringify(body));
  const status = execFileSync('curl', args, { encoding: 'utf8' }).trim();
  if (!expectedStatuses.includes(Number(status))) {
    throw new Error(`${url} returned ${status}; expected ${expectedStatuses.join(' or ')}`);
  }
  console.log(`${method} ${url} -> ${status}`);
}
