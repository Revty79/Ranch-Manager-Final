const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://208.88.9.175:3002';
const outDir = path.join(process.cwd(), 'test-artifacts', `bulk-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });

const id = String(Date.now()).slice(-6);
const results = [];
function add(name, data) {
  const row = { ts: new Date().toISOString(), name, ...data };
  results.push(row);
  console.log(JSON.stringify(row));
}

async function waitForButtonText(form, submitLabel, pendingLabel, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const pendingCount = await form.getByRole('button', { name: pendingLabel }).count().catch(() => 0);
    const submitCount = await form.getByRole('button', { name: submitLabel }).count().catch(() => 0);
    if (pendingCount === 0 && submitCount > 0) return true;
    await new Promise((r) => setTimeout(r, 600));
  }
  return false;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });

  page.on('console', (msg) => {
    if (msg.type() === 'error') add('console_error', { text: msg.text() });
  });

  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Username').fill('Cody');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForTimeout(1300);
  add('login', { url: page.url() });

  // Team: add forgetful + bad-tech workers if not already present in this run id
  await page.goto(`${baseUrl}/app/team`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  const teamForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add member' }) }).first();

  const workers = [
    { fullName: `Lane Morris Forgetful ${id}`, username: `lane-forgetful-${id}`, role: 'worker', pay: '20.00' },
    { fullName: `Ty Brooks Badtech ${id}`, username: `ty-badtech-${id}`, role: 'worker', pay: '19.50' },
  ];

  for (const worker of workers) {
    await teamForm.getByLabel('Full name').fill(worker.fullName);
    await teamForm.getByLabel('Username').fill(worker.username);
    await teamForm.getByLabel('Temporary password').fill('RanchPass123!');
    await teamForm.getByLabel('Role').selectOption(worker.role);
    await teamForm.getByLabel('Pay rate').fill(worker.pay);
    await teamForm.getByRole('button', { name: 'Add member' }).click();
    const ok = await waitForButtonText(teamForm, 'Add member', 'Adding member...', 45000);
    const rowVisible = await page.getByText(worker.username, { exact: false }).first().isVisible().catch(() => false);
    add('worker_add', { worker: worker.username, ok, rowVisible });
  }

  await page.screenshot({ path: path.join(outDir, 'team.png'), fullPage: true });

  // Herd: add 20 cattle + 2 horses
  await page.goto(`${baseUrl}/app/herd`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const herdForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add animal' }) }).first();

  const cattle = [];
  for (let i = 1; i <= 20; i++) {
    let sex = 'female';
    let cls = 'Cow';
    if (i >= 9 && i <= 12) {
      sex = i % 2 === 0 ? 'male' : 'female';
      cls = 'Calf';
    } else if (i >= 13 && i <= 15) {
      sex = 'male';
      cls = 'Bull';
    } else if (i >= 16) {
      sex = 'castrated_male';
      cls = 'Steer';
    }
    cattle.push({
      tag: `MTRB-${id}-C${String(i).padStart(2, '0')}`,
      internal: `MTRB-${id}-IC${String(i).padStart(2, '0')}`,
      sex,
      cls,
      species: 'cattle',
      breed: i % 3 === 0 ? 'Hereford' : 'Angus',
    });
  }

  const horses = [
    { tag: `MTRB-${id}-H01`, internal: `MTRB-${id}-IH01`, sex: 'female', cls: 'Mare', species: 'horse', breed: 'Quarter Horse', display: 'Juniper' },
    { tag: `MTRB-${id}-H02`, internal: `MTRB-${id}-IH02`, sex: 'male', cls: 'Gelding', species: 'horse', breed: 'Quarter Horse', display: 'Dusty' },
  ];

  const animals = [...cattle, ...horses];

  for (const a of animals) {
    await herdForm.getByLabel('Tag / visual ID').fill(a.tag);
    await herdForm.getByLabel('Internal ID').fill(a.internal);
    await herdForm.getByLabel('Display name (optional)').fill(a.display ?? '');
    await herdForm.getByLabel('Species').selectOption(a.species);
    await herdForm.getByLabel('Sex').selectOption(a.sex);
    await herdForm.getByLabel('Class / category').fill(a.cls);
    await herdForm.getByLabel('Breed').fill(a.breed);
    await herdForm.getByRole('button', { name: 'Add animal' }).click();
    const ok = await waitForButtonText(herdForm, 'Add animal', 'Saving animal...', 45000);
    add('animal_add', { tag: a.tag, species: a.species, cls: a.cls, ok });
  }

  // Mistake record edit/delete
  const mistakenTag = `MTRB-${id}-MISTAKE`;
  await herdForm.getByLabel('Tag / visual ID').fill(mistakenTag);
  await herdForm.getByLabel('Internal ID').fill(`MTRB-${id}-IMISTAKE`);
  await herdForm.getByLabel('Display name (optional)').fill('Mistake Entry');
  await herdForm.getByLabel('Species').selectOption('cattle');
  await herdForm.getByLabel('Sex').selectOption('female');
  await herdForm.getByLabel('Class / category').fill('Cow');
  await herdForm.getByRole('button', { name: 'Add animal' }).click();
  const mistakeAdded = await waitForButtonText(herdForm, 'Add animal', 'Saving animal...', 45000);
  add('mistake_add', { mistakenTag, ok: mistakeAdded });

  await page.getByRole('textbox', { name: 'Search' }).fill(mistakenTag);
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await page.waitForTimeout(900);
  await page.getByRole('link', { name: 'Open' }).first().click();
  await page.waitForTimeout(800);

  const editForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save changes' }) }).first();
  await editForm.getByLabel('Display name (optional)').fill('Mistake Entry Corrected');
  await editForm.getByRole('button', { name: 'Save changes' }).click();
  const editOk = await waitForButtonText(editForm, 'Save changes', 'Saving changes...', 45000);
  add('mistake_edit', { ok: editOk });

  page.once('dialog', (dialog) => dialog.accept());
  const deleteForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Delete animal permanently' }) }).first();
  await deleteForm.getByPlaceholder(mistakenTag).fill(mistakenTag);
  await deleteForm.getByRole('button', { name: 'Delete animal permanently' }).click();
  await page.waitForTimeout(1200);
  add('mistake_delete', { url: page.url() });

  await page.screenshot({ path: path.join(outDir, 'herd.png'), fullPage: true });

  // Land: add named units
  await page.goto(`${baseUrl}/app/land`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const landForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add land unit' }) }).first();
  const landUnits = [
    { name: 'North Pasture', code: `NP-${id}`, unitType: 'pasture', acreage: '120', grazeable: '110' },
    { name: 'Lower Field', code: `LF-${id}`, unitType: 'field', acreage: '65', grazeable: '58' },
    { name: 'Creek Lot', code: `CL-${id}`, unitType: 'lot', acreage: '24', grazeable: '20' },
    { name: 'Holding Pen', code: `HP-${id}`, unitType: 'pen', acreage: '2', grazeable: '2' },
    { name: 'Winter Lot', code: `WL-${id}`, unitType: 'lot', acreage: '36', grazeable: '31' },
  ];

  for (const u of landUnits) {
    await landForm.getByLabel('Name').fill(u.name);
    await landForm.getByLabel('Code (optional)').fill(u.code);
    await landForm.getByLabel('Unit type').selectOption(u.unitType);
    await landForm.getByLabel('Acreage (optional)').fill(u.acreage);
    await landForm.getByLabel('Grazeable acreage (optional)').fill(u.grazeable);
    await landForm.getByLabel('Water source summary').fill('Trough + spring line');
    await landForm.getByLabel('Fencing / condition summary').fill('4-strand barbed, serviceable');
    await landForm.getByRole('button', { name: 'Add land unit' }).click();
    const ok = await waitForButtonText(landForm, 'Add land unit', 'Saving land unit...', 45000);
    add('land_add', { code: u.code, name: u.name, ok });
  }

  await page.screenshot({ path: path.join(outDir, 'land.png'), fullPage: true });

  // Work-orders blocker capture
  await page.goto(`${baseUrl}/app/work-orders`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const bodyText = await page.locator('body').innerText();
  add('work_orders', { blocked: bodyText.includes('Unable to load this app section'), url: page.url() });
  await page.screenshot({ path: path.join(outDir, 'work-orders.png'), fullPage: true });

  const file = path.join(outDir, 'summary.json');
  fs.writeFileSync(file, JSON.stringify(results, null, 2));
  add('done', { file, outDir });

  await browser.close();
})();
