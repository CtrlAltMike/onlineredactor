import { expect, test } from '@playwright/test';

test('homepage renders', async ({ page }) => {
  await page.goto('/');
  const heading = page.getByRole('heading', { level: 1 });
  await expect(heading).toBeVisible();
  await expect(heading).toHaveText(/verification gates/i);
});
