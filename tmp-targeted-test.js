const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://208.88.9.175:3002';
const outDir = path.join(process.cwd(), 'test-artifacts', `targeted-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });

const id = String(Date.now()).slice(-6);
const results = [];

function add(name, data) {
  const row = { ts: new Date().toISOString(), name, ...data };
  results.push(row);
  console.log(JSON.stringify(row));
}

async function snap(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  add('screenshot', { file, name });
}

async function waitForFormDone(form, submitLabel, pendingLabel, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const text = await form.innerText();
    if (text.includes('error') || text.includes('Error') || text.includes('Unable')) {
      return { state: 'error', text: text.replace(/\s+/g, ' ').slice(0, 240) };
    }
    if (text.includes('Team member added') || text.includes('Animal created') || text.includes('Land unit created') || text.includes('created.')) {
      return { state: 'success', text: text.replace(/\s+/g, ' ').slice(0, 240) };
    }
    const pendingVisible = await form.getByRole('button', { name: pendingLabel }).count().catch(() => 0);
    const submitVisible = await form.getByRole('button', { name: submitLabel }).count().catch(() => 0);
    if (pendingVisible === 0 && submitVisible > 0) {
      return { state: 'idle', text: text.replace(/\s+/g, ' ').slice(0, 240) };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  const text = await form.innerText();
  return { state: 'timeout', text: text.replace(/\s+/g, ' ').slice(0, 240) };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });

  page.on('console', msg => { if (msg.type() === 'error') add('console_error', { text: msg.text() }); });
  page.on('pageerror', err => add('page_error', { text: err.message }));
  page.on('requestfailed', req => add('request_failed', { url: req.url(), method: req.method(), failure: req.failure()?.errorText }));

  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Username').fill('Cody');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForTimeout(1500);
  add('login', { url: page.url() });

  await page.goto(`${baseUrl}/app/team`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  const teamForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add member' }) }).first();
  const worker = {
    fullName: `Milo Test Worker ${id}`,
    username: `milo-worker-${id}`,
  };
  await teamForm.getByLabel('Full name').fill(worker.fullName);
  await teamForm.getByLabel('Username').fill(worker.username);
  await teamForm.getByLabel('Temporary password').fill('RanchPass123!');
  await teamForm.getByLabel('Role').selectOption('worker');
  await teamForm.getByLabel('Pay rate').fill('18.75');
  await teamForm.getByRole('button', { name: 'Add member' }).click();
  const teamDone = await waitForFormDone(teamForm, 'Add member', 'Adding member...', 45000);
  const workerVisible = await page.getByText(worker.username, { exact: false }).first().isVisible().catch(() => false);
  add('team_add_result', { teamDone, workerVisible });
  await snap(page, 'team-after-single-add');

  await page.goto(`${baseUrl}/app/herd`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const herdForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add animal' }) }).first();
  const tag = `MTR-TGT-${id}`;
  await herdForm.getByLabel('Tag / visual ID').fill(tag);
  await herdForm.getByLabel('Internal ID').fill(`MTR-TGT-INT-${id}`);
  await herdForm.getByLabel('Species').selectOption('cattle');
  await herdForm.getByLabel('Sex').selectOption('female');
  await herdForm.getByLabel('Class / category').fill('Cow');
  await herdForm.getByRole('button', { name: 'Add animal' }).click();
  const herdDone = await waitForFormDone(herdForm, 'Add animal', 'Saving animal...', 45000);
  await page.getByRole('textbox', { name: 'Search' }).fill(tag);
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.waitForTimeout(1000);
  const tagVisible = await page.getByText(tag, { exact: false }).first().isVisible().catch(() => false);
  add('herd_add_result', { herdDone, tagVisible });
  await snap(page, 'herd-after-single-add');

  await page.goto(`${baseUrl}/app/land`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const landForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add land unit' }) }).first();
  const code = `TGT-${id}`;
  await landForm.getByLabel('Name').fill(`Target Lot ${id}`);
  await landForm.getByLabel('Code (optional)').fill(code);
  await landForm.getByLabel('Unit type').selectOption('lot');
  await landForm.getByRole('button', { name: 'Add land unit' }).click();
  const landDone = await waitForFormDone(landForm, 'Add land unit', 'Saving land unit...', 45000);
  await page.getByRole('textbox', { name: 'Search' }).fill(code);
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.waitForTimeout(1000);
  const codeVisible = await page.getByText(code, { exact: false }).first().isVisible().catch(() => false);
  add('land_add_result', { landDone, codeVisible });
  await snap(page, 'land-after-single-add');

  await page.goto(`${baseUrl}/app/work-orders`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const bodyText = await page.locator('body').innerText();
  const hasErrorState = bodyText.includes('Unable to load this app section');
  add('work_orders_state', { url: page.url(), hasErrorState, sample: bodyText.replace(/\s+/g, ' ').slice(0, 260) });
  await snap(page, 'work-orders-state');

  const summaryFile = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(results, null, 2));
  add('summary', { summaryFile, outDir });

  await browser.close();
})();
