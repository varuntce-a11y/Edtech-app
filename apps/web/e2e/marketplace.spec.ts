import { expect, test } from '@playwright/test';

async function signIn(page: import('@playwright/test').Page, email: string, redirect = '/') {
  await page.goto(`/login?redirect=${encodeURIComponent(redirect)}`);
  await page.getByLabel('Email or mobile number').fill(email);
  await page.getByRole('button', { name: 'Continue with email or phone' }).click();
  const code = await page.locator('.dev-code strong').textContent();
  expect(code).toMatch(/^\d{6}$/);
  await page.getByLabel('Your name').fill('Demo Learner');
  await page.getByLabel('6-digit verification code').fill(code!);
  await page.getByRole('combobox', { name: 'What are you working towards?' }).selectOption('Data Analyst');
  await page.getByLabel(/I agree to the privacy policy/).check();
  await page.getByRole('button', { name: 'Verify & continue' }).click();
  await expect(page).toHaveURL(/localhost:3000\/(?:$|admin\/courses)/, { timeout: 10_000 });
}

test('signup, browse a course, and complete a local test purchase', async ({ page }) => {
  await signIn(page, `learner-${Date.now()}@upskillin.demo`);
  await expect(page.locator('.account-trigger-name')).toHaveText('Demo Learner');
  await page.getByRole('button', { name: 'Account details for Demo Learner' }).click();
  await expect(page.getByRole('region', { name: 'Account details' })).toContainText('Demo Learner');
  await expect(page.getByText(/learner-.*@upskillin\.demo/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Account details' }).getByText('Data Analyst', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Find your next skill.' })).toBeVisible();
  await page.getByLabel('Search courses').fill('Excel Mastery for Business Analysts');
  await page.getByRole('button', { name: /Add Excel Mastery for Business Analysts to cart/ }).click();
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: 'Your learning cart.' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('upskillin-access-token', 'expired-access-token'));
  await page.reload();
  await expect(page.locator('.form-error')).toHaveCount(0);
  await page.getByRole('link', { name: 'Continue to checkout' }).click();
  await page.getByLabel('Billing address').fill('12 MG Road, Bengaluru, Karnataka 560001');
  await page.getByLabel(/I agree to the refund policy/).check();
  await page.getByRole('button', { name: /Pay .* securely/ }).click();
  await expect(page.getByRole('heading', { name: 'One step closer.' })).toBeVisible({ timeout: 10_000 });
  await page.evaluate(() => localStorage.setItem('upskillin-access-token', 'expired-access-token'));
  await page.getByRole('link', { name: 'Go to My Courses' }).click();
  await expect(page.getByRole('heading', { name: 'Excel Mastery for Business Analysts' })).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: 'Account details for Demo Learner' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('link', { name: 'Log in' })).toBeVisible();
});

test('combines catalog filters and keeps them in the URL', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Filters/ }).click();
  await page.getByLabel('Topic').selectOption('Artificial Intelligence');
  await page.getByLabel('Delivery').selectOption('virtual');
  await page.getByLabel('Course language').selectOption('en');
  await page.getByLabel('Assessment').selectOption('no');
  await page.getByLabel('Instructor').fill('Neha');
  await page.getByLabel('Minimum price in rupees').evaluate((element) => {
    const slider = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(slider, '3000');
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.getByLabel('Maximum price in rupees').evaluate((element) => {
    const slider = element as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(slider, '4000');
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect(page).toHaveURL(/topic=Artificial\+Intelligence/);
  await expect(page).toHaveURL(/mode=virtual/);
  await expect(page).toHaveURL(/language=en/);
  await expect(page).toHaveURL(/assessment=no/);
  await expect(page).toHaveURL(/minPrice=3000/);
  await expect(page.getByText('1 course to explore')).toBeVisible();
});

test('admin creates a course draft from the course studio', async ({ page }) => {
  await signIn(page, 'admin@upskillin.demo', '/admin/courses');
  const courseTitle = `Practical SQL for Hyderabad Analysts ${Date.now()}`;
  await page.getByLabel('Course title').fill(courseTitle);
  await page.getByLabel('Short description').fill('Learn SQL skills for practical analyst work.');
  await page.getByLabel('Course description').fill('A practical SQL course for graduates and professionals. Build queries, explore datasets and prepare for analyst interviews.');
  await page.getByLabel('Topic').fill('Data & Analytics');
  await page.getByLabel('Course language').selectOption('en');
  await page.getByLabel('Delivery format').selectOption('SELF_PACED');
  await page.getByLabel('Price (INR)').fill('2499');
  await page.locator('select[name="instructorId"]').selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Save course draft' }).click();
  await expect(page.getByText(`${courseTitle} saved as a draft. Publish it when it is ready.`)).toBeVisible();
  await expect(page.locator('.admin-course-list').getByText(courseTitle, { exact: true })).toBeVisible();
});
