const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://208.88.9.175:3002';
const outDir = path.join(process.cwd(), 'test-artifacts', `owner-test-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });

const runId = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(2, 14);
const shortId = runId.slice(-6);

const log = [];
const errors = [];

function now() {
  return new Date().toISOString();
}

function push(entry) {
  const row = { ts: now(), ...entry };
  log.push(row);
  console.log(JSON.stringify(row));
}

async function screenshot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  push({ type: 'screenshot', name, file });
}

async function safeStep(name, fn) {
  push({ type: 'step_start', name });
  try {
    const result = await fn();
    push({ type: 'step_ok', name, result: result ?? null });
    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    push({ type: 'step_fail', name, error: message });
    errors.push({ name, error: message });
    return { ok: false, error: message };
  }
}

async function formFeedback(form) {
  const text = (await form.innerText()).replace(/\s+/g, ' ').trim();
  const lines = text.split(' ');
  return { text, sample: lines.slice(0, 60).join(' ') };
}

function dueDateTimeLocal(daysOffset, hour = 8, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, minute, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      push({ type: 'console_error', text: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    push({ type: 'page_error', text: err.message });
  });
  page.on('requestfailed', (req) => {
    push({
      type: 'request_failed',
      url: req.url(),
      method: req.method(),
      failure: req.failure()?.errorText ?? 'unknown',
    });
  });

  const created = {
    team: [],
    animals: [],
    horses: [],
    landUnits: [],
    workOrders: [],
    templates: [],
  };

  await safeStep('open_login', async () => {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(300);
    return { url: page.url(), title: await page.title() };
  });

  await safeStep('login_owner', async () => {
    await page.getByLabel('Username').fill('Cody');
    await page.getByLabel('Password').fill('password');
    await Promise.all([
      page.getByRole('button', { name: 'Log in' }).click(),
      page.waitForTimeout(1500),
    ]);

    for (let i = 0; i < 12; i++) {
      const url = page.url();
      if (
        /\/app|\/onboarding|\/reset-password|\/billing-required|\/no-ranch-access|\/onboarding-incomplete/.test(
          url,
        )
      ) {
        break;
      }
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(1000);
    const h1 = await page.locator('h1').first().textContent().catch(() => null);
    return { url: page.url(), h1 };
  });

  await screenshot(page, 'after-login');

  if (page.url().includes('/onboarding')) {
    await safeStep('complete_onboarding', async () => {
      await page.getByLabel('Ranch name').fill('Marysvale Test Ranch');
      await page.getByLabel('Payroll cadence default').selectOption('biweekly');
      await page.getByRole('button', { name: 'Create ranch workspace' }).click();
      await page.waitForTimeout(2000);
      return { url: page.url() };
    });
    await screenshot(page, 'after-onboarding');
  }

  await safeStep('read_ranch_name_from_sidebar', async () => {
    const ranchCard = page.locator('aside').first();
    const text = await ranchCard.innerText().catch(() => '');
    return { sidebarText: text };
  });

  await safeStep('open_team_page', async () => {
    await page.goto(`${baseUrl}/app/team`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1000);
    return { url: page.url(), h1: await page.locator('h1').first().textContent().catch(() => null) };
  });
  await screenshot(page, 'team-start');

  const teamMembers = [
    {
      fullName: `Aubrey Jensen Manager ${shortId}`,
      username: `aubrey-mgr-${shortId}`,
      role: 'manager',
      payType: 'hourly',
      payRate: '32.00',
      tempPassword: 'RanchPass123!',
      persona: 'manager',
    },
    {
      fullName: `Reed Dalton Reliable ${shortId}`,
      username: `reed-reliable-${shortId}`,
      role: 'worker',
      payType: 'hourly',
      payRate: '24.50',
      tempPassword: 'RanchPass123!',
      persona: 'reliable worker',
    },
    {
      fullName: `Lane Morris Forgetful ${shortId}`,
      username: `lane-forgetful-${shortId}`,
      role: 'worker',
      payType: 'hourly',
      payRate: '20.00',
      tempPassword: 'RanchPass123!',
      persona: 'forgetful worker',
    },
    {
      fullName: `Ty Brooks Badtech ${shortId}`,
      username: `ty-badtech-${shortId}`,
      role: 'worker',
      payType: 'hourly',
      payRate: '19.25',
      tempPassword: 'RanchPass123!',
      persona: 'bad-at-tech worker',
    },
  ];

  for (const member of teamMembers) {
    await safeStep(`add_team_${member.username}`, async () => {
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add member' }) }).first();
      await form.getByLabel('Full name').fill(member.fullName);
      await form.getByLabel('Username').fill(member.username);
      await form.getByLabel('Temporary password').fill(member.tempPassword);
      await form.getByLabel('Role').selectOption(member.role);
      await form.getByLabel('Pay type').selectOption(member.payType);
      await form.getByLabel('Pay rate').fill(member.payRate);
      await form.getByRole('button', { name: 'Add member' }).click();
      await page.waitForTimeout(1200);
      const fb = await formFeedback(form);
      const rowVisible = await page.getByText(member.username, { exact: false }).first().isVisible().catch(() => false);
      created.team.push({ ...member, rowVisible, formFeedback: fb.sample });
      return { rowVisible, formFeedback: fb.sample };
    });
  }

  await screenshot(page, 'team-after-add');

  await safeStep('open_herd_page', async () => {
    await page.goto(`${baseUrl}/app/herd`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1500);
    return { url: page.url(), h1: await page.locator('h1').first().textContent().catch(() => null) };
  });
  await screenshot(page, 'herd-start');

  const cattle = [
    { tag: `MTR-${shortId}-C01`, internal: `MTR-${shortId}-INT-C01`, sex: 'female', cls: 'Cow', breed: 'Angus' },
    { tag: `MTR-${shortId}-C02`, internal: `MTR-${shortId}-INT-C02`, sex: 'female', cls: 'Cow', breed: 'Angus' },
    { tag: `MTR-${shortId}-C03`, internal: `MTR-${shortId}-INT-C03`, sex: 'female', cls: 'Cow', breed: 'Hereford' },
    { tag: `MTR-${shortId}-C04`, internal: `MTR-${shortId}-INT-C04`, sex: 'female', cls: 'Cow', breed: 'Black Baldy' },
    { tag: `MTR-${shortId}-C05`, internal: `MTR-${shortId}-INT-C05`, sex: 'female', cls: 'Cow', breed: 'Angus' },
    { tag: `MTR-${shortId}-C06`, internal: `MTR-${shortId}-INT-C06`, sex: 'female', cls: 'Cow', breed: 'Hereford' },
    { tag: `MTR-${shortId}-C07`, internal: `MTR-${shortId}-INT-C07`, sex: 'female', cls: 'Cow', breed: 'Angus' },
    { tag: `MTR-${shortId}-C08`, internal: `MTR-${shortId}-INT-C08`, sex: 'female', cls: 'Cow', breed: 'Angus' },
    { tag: `MTR-${shortId}-C09`, internal: `MTR-${shortId}-INT-C09`, sex: 'female', cls: 'Calf', breed: 'Angus' },
    { tag: `MTR-${shortId}-C10`, internal: `MTR-${shortId}-INT-C10`, sex: 'male', cls: 'Calf', breed: 'Angus' },
    { tag: `MTR-${shortId}-C11`, internal: `MTR-${shortId}-INT-C11`, sex: 'male', cls: 'Calf', breed: 'Hereford' },
    { tag: `MTR-${shortId}-C12`, internal: `MTR-${shortId}-INT-C12`, sex: 'female', cls: 'Calf', breed: 'Angus' },
    { tag: `MTR-${shortId}-C13`, internal: `MTR-${shortId}-INT-C13`, sex: 'male', cls: 'Bull', breed: 'Angus' },
    { tag: `MTR-${shortId}-C14`, internal: `MTR-${shortId}-INT-C14`, sex: 'male', cls: 'Bull', breed: 'Hereford' },
    { tag: `MTR-${shortId}-C15`, internal: `MTR-${shortId}-INT-C15`, sex: 'male', cls: 'Bull', breed: 'Angus' },
    { tag: `MTR-${shortId}-C16`, internal: `MTR-${shortId}-INT-C16`, sex: 'castrated_male', cls: 'Steer', breed: 'Angus' },
    { tag: `MTR-${shortId}-C17`, internal: `MTR-${shortId}-INT-C17`, sex: 'castrated_male', cls: 'Steer', breed: 'Angus' },
    { tag: `MTR-${shortId}-C18`, internal: `MTR-${shortId}-INT-C18`, sex: 'castrated_male', cls: 'Steer', breed: 'Hereford' },
    { tag: `MTR-${shortId}-C19`, internal: `MTR-${shortId}-INT-C19`, sex: 'castrated_male', cls: 'Steer', breed: 'Angus' },
    { tag: `MTR-${shortId}-C20`, internal: `MTR-${shortId}-INT-C20`, sex: 'castrated_male', cls: 'Steer', breed: 'Angus' },
  ];

  const horses = [
    { tag: `MTR-${shortId}-H01`, internal: `MTR-${shortId}-INT-H01`, sex: 'female', cls: 'Mare', breed: 'Quarter Horse', display: 'Juniper' },
    { tag: `MTR-${shortId}-H02`, internal: `MTR-${shortId}-INT-H02`, sex: 'male', cls: 'Gelding', breed: 'Quarter Horse', display: 'Dusty' },
  ];

  async function addAnimal(item, species = 'cattle') {
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add animal' }) }).first();
    await form.getByLabel('Tag / visual ID').fill(item.tag);
    await form.getByLabel('Internal ID').fill(item.internal);
    await form.getByLabel('Display name (optional)').fill(item.display ?? '');
    await form.getByLabel('Species').selectOption(species);
    await form.getByLabel('Sex').selectOption(item.sex);
    await form.getByLabel('Class / category').fill(item.cls);
    await form.getByLabel('Breed').fill(item.breed);
    await form.getByRole('button', { name: 'Add animal' }).click();
    await page.waitForTimeout(700);
    const feedback = await formFeedback(form);
    return feedback.sample;
  }

  for (const c of cattle) {
    await safeStep(`add_cattle_${c.tag}`, async () => {
      const feedback = await addAnimal(c, 'cattle');
      created.animals.push({ ...c, feedback });
      return { feedback };
    });
  }

  for (const h of horses) {
    await safeStep(`add_horse_${h.tag}`, async () => {
      const feedback = await addAnimal(h, 'horse');
      created.horses.push({ ...h, feedback });
      return { feedback };
    });
  }

  await screenshot(page, 'herd-after-add');

  const mistaken = { tag: `MTR-${shortId}-MISTAKE`, internal: `MTR-${shortId}-INT-MISTAKE`, sex: 'female', cls: 'Cow', breed: 'Angus', display: 'Mistake Entry' };

  await safeStep('add_mistaken_animal', async () => {
    const feedback = await addAnimal(mistaken, 'cattle');
    created.animals.push({ ...mistaken, feedback, mistaken: true });
    return { feedback };
  });

  await safeStep('open_mistaken_animal_detail', async () => {
    await page.getByRole('link', { name: 'Reset' }).click().catch(() => {});
    await page.waitForTimeout(300);
    await page.getByRole('textbox', { name: 'Search' }).fill(mistaken.tag);
    await page.getByRole('button', { name: 'Apply filters' }).click();
    await page.waitForTimeout(1200);
    const openBtn = page.getByRole('link', { name: 'Open' }).first();
    await openBtn.click();
    await page.waitForTimeout(1000);
    return { url: page.url() };
  });

  await safeStep('edit_mistaken_animal_name', async () => {
    const editForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save changes' }) }).first();
    await editForm.getByLabel('Display name (optional)').fill('Mistake Entry Corrected');
    await editForm.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForTimeout(1000);
    const fb = await editForm.innerText();
    return { feedback: fb.replace(/\s+/g, ' ').slice(0, 220) };
  });

  await safeStep('delete_mistaken_animal', async () => {
    page.once('dialog', (dialog) => dialog.accept());
    const deleteForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Delete animal permanently' }) }).first();
    await deleteForm.getByPlaceholder(mistaken.tag).fill(mistaken.tag);
    await deleteForm.getByRole('button', { name: 'Delete animal permanently' }).click();
    await page.waitForTimeout(1500);
    return { url: page.url() };
  });

  await screenshot(page, 'herd-after-mistake-delete');

  await safeStep('open_land_page', async () => {
    await page.goto(`${baseUrl}/app/land`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1000);
    return { url: page.url(), h1: await page.locator('h1').first().textContent().catch(() => null) };
  });
  await screenshot(page, 'land-start');

  const landUnits = [
    { name: 'North Pasture', code: `NP-${shortId}`, unitType: 'pasture', acreage: '120', grazeable: '110' },
    { name: 'Lower Field', code: `LF-${shortId}`, unitType: 'field', acreage: '60', grazeable: '52' },
    { name: 'Creek Lot', code: `CL-${shortId}`, unitType: 'lot', acreage: '22', grazeable: '20' },
    { name: 'Holding Pen', code: `HP-${shortId}`, unitType: 'pen', acreage: '2', grazeable: '2' },
    { name: 'Winter Lot', code: `WL-${shortId}`, unitType: 'lot', acreage: '35', grazeable: '30' },
  ];

  for (const unit of landUnits) {
    await safeStep(`add_land_${unit.code}`, async () => {
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Add land unit' }) }).first();
      await form.getByLabel('Name').fill(unit.name);
      await form.getByLabel('Code (optional)').fill(unit.code);
      await form.getByLabel('Unit type').selectOption(unit.unitType);
      await form.getByLabel('Acreage (optional)').fill(unit.acreage);
      await form.getByLabel('Grazeable acreage (optional)').fill(unit.grazeable);
      await form.getByLabel('Water source summary').fill('Trough + spring line');
      await form.getByLabel('Fencing / condition summary').fill('4-strand barbed, fair');
      await form.getByRole('button', { name: 'Add land unit' }).click();
      await page.waitForTimeout(900);
      const fb = await formFeedback(form);
      const rowVisible = await page.getByText(unit.code, { exact: false }).first().isVisible().catch(() => false);
      created.landUnits.push({ ...unit, rowVisible, feedback: fb.sample });
      return { rowVisible, feedback: fb.sample };
    });
  }

  await screenshot(page, 'land-after-add');

  await safeStep('open_work_orders_page', async () => {
    await page.goto(`${baseUrl}/app/work-orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(1200);
    return { url: page.url(), h1: await page.locator('h1').first().textContent().catch(() => null) };
  });
  await screenshot(page, 'work-orders-start');

  const workOrders = [
    {
      title: `Water check ${shortId}`,
      due: dueDateTimeLocal(0, 7, 30),
      priority: 'high',
      status: 'open',
      description: 'Check all troughs in North Pasture and Creek Lot before 9 AM.',
      assigneeText: 'Reliable',
    },
    {
      title: `Feed check ${shortId}`,
      due: dueDateTimeLocal(0, 8, 30),
      priority: 'normal',
      status: 'open',
      description: 'Confirm hay drop and mineral tubs at Lower Field and Winter Lot.',
      assigneeText: 'Forgetful',
    },
    {
      title: `Fence repair ${shortId}`,
      due: dueDateTimeLocal(-1, 16, 0),
      priority: 'high',
      status: 'open',
      description: 'Repair downed west fence line. This should appear overdue.',
      assigneeText: 'Badtech',
    },
    {
      title: `Animal health check ${shortId}`,
      due: dueDateTimeLocal(1, 10, 0),
      priority: 'high',
      status: 'open',
      description: 'Walk calves and note cough, lameness, or appetite concerns.',
      assigneeText: 'Manager',
    },
    {
      title: `Move/check cattle ${shortId}`,
      due: dueDateTimeLocal(2, 11, 0),
      priority: 'normal',
      status: 'draft',
      description: 'Prep move from North Pasture to Lower Field and verify gate hardware.',
      assigneeText: 'Reliable',
    },
  ];

  function findAssigneeName(target) {
    const names = created.team.map((m) => m.fullName);
    if (target === 'Reliable') return names.find((n) => n.includes('Reliable'));
    if (target === 'Forgetful') return names.find((n) => n.includes('Forgetful'));
    if (target === 'Badtech') return names.find((n) => n.includes('Badtech'));
    if (target === 'Manager') return names.find((n) => n.includes('Manager'));
    return undefined;
  }

  for (const order of workOrders) {
    await safeStep(`create_work_order_${order.title}`, async () => {
      const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create work order' }) }).first();
      await form.getByLabel('Title').fill(order.title);
      await form.getByLabel('Due date (optional)').fill(order.due);
      await form.getByLabel('Status').selectOption(order.status);
      await form.getByLabel('Priority').selectOption(order.priority);
      await form.getByLabel('Description').fill(order.description);

      const assigneeName = findAssigneeName(order.assigneeText);
      if (assigneeName) {
        const label = form.getByText(assigneeName, { exact: false }).first();
        const checkbox = label.locator('xpath=preceding-sibling::input[@type="checkbox"]').first();
        if (await checkbox.count()) {
          await checkbox.check();
        } else {
          const fallback = form.locator('label').filter({ hasText: assigneeName }).locator('input[type="checkbox"]').first();
          if (await fallback.count()) await fallback.check();
        }
      }

      await form.getByRole('button', { name: 'Create work order' }).click();
      await page.waitForTimeout(1200);
      const fb = await formFeedback(form);
      const rowVisible = await page.getByText(order.title, { exact: false }).first().isVisible().catch(() => false);
      created.workOrders.push({ ...order, assigneeName, rowVisible, feedback: fb.sample });
      return { assigneeName, rowVisible, feedback: fb.sample };
    });
  }

  await safeStep('create_recurring_template', async () => {
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save template' }) }).first();
    const templateName = `Weekly water patrol ${shortId}`;
    const title = `Weekly water patrol order ${shortId}`;

    await form.getByLabel('Template name').fill(templateName);
    await form.getByLabel('Work order title').fill(title);
    await form.getByLabel('Description').fill('Weekly recurring water source check across all active units.');
    await form.getByLabel('Priority').selectOption('normal');
    await form.getByLabel('Compensation type').selectOption('standard');

    const reliable = created.team.find((m) => m.fullName.includes('Reliable'))?.fullName;
    if (reliable) {
      const cb = form.locator('label').filter({ hasText: reliable }).locator('input[type="checkbox"]').first();
      if (await cb.count()) await cb.check();
    }

    await form.getByRole('button', { name: 'Save template' }).click();
    await page.waitForTimeout(1200);

    const templateCard = page.locator(`div:has-text("${templateName}")`).first();
    const hasTemplateCard = await templateCard.count();

    if (hasTemplateCard) {
      const recurringCb = templateCard.getByLabel('Recurring').first();
      const activeCb = templateCard.getByLabel('Active').first();
      if (await activeCb.count()) await activeCb.check();
      if (await recurringCb.count()) await recurringCb.check();
      await templateCard.locator('select[name="recurrenceCadence"]').selectOption('weekly');
      const nextInput = templateCard.locator('input[name="nextGenerationOn"]').first();
      const nextDate = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const ds = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDate.getDate())}`;
      await nextInput.fill(ds);
      await templateCard.getByRole('button', { name: 'Save' }).click();
      await page.waitForTimeout(1000);
    }

    created.templates.push({ templateName, title, hasTemplateCard: Boolean(hasTemplateCard) });
    return { templateName, found: Boolean(hasTemplateCard) };
  });

  await screenshot(page, 'work-orders-after-add');

  await safeStep('create_and_edit_mistake_work_order', async () => {
    const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create work order' }) }).first();
    const wrongTitle = `WRONG TASK ${shortId}`;
    const correctedTitle = `Corrected task ${shortId}`;

    await form.getByLabel('Title').fill(wrongTitle);
    await form.getByLabel('Priority').selectOption('low');
    await form.getByLabel('Status').selectOption('open');
    await form.getByLabel('Description').fill('Intentional mistake entry for edit test.');
    await form.getByRole('button', { name: 'Create work order' }).click();
    await page.waitForTimeout(1000);

    await page.getByRole('link', { name: 'Edit' }).filter({ hasText: '' }).first().click();
    await page.waitForTimeout(1000);

    const detailForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save changes' }) }).first();
    await detailForm.getByLabel('Title').fill(correctedTitle);
    await detailForm.getByRole('button', { name: 'Save changes' }).click();
    await page.waitForTimeout(1200);

    return { wrongTitle, correctedTitle, url: page.url() };
  });

  await screenshot(page, 'work-order-mistake-edit');

  await safeStep('capture_mojibake_probe', async () => {
    await page.goto(`${baseUrl}/app/land`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(800);
    const body = await page.locator('body').innerText();
    const hasMojibake = /Ã|Â|â‚¬|â€”/.test(body);
    return { hasMojibake };
  });

  await safeStep('collect_final_snapshot', async () => {
    const summary = {
      finalUrl: page.url(),
      created,
      errors,
      outDir,
    };
    const file = path.join(outDir, 'summary.json');
    fs.writeFileSync(file, JSON.stringify({ log, summary }, null, 2));
    return { file, outDir };
  });

  await browser.close();
})();
