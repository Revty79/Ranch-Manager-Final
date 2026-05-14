const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://208.88.9.175:3002';
const outDir = path.join(process.cwd(), 'test-artifacts', `resume-workorders-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });

const rid = String(Date.now()).slice(-6);
const result = { runId: rid, actions: [], bugs: [], ux: [], snapshots: [] };

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dt(daysOffset, hour = 8, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, min, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function snap(page, name) {
  const f = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: f, fullPage: true });
  result.snapshots.push({ name, file: f });
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByLabel('Username').fill('cody');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await sleep(1600);
  if (!page.url().includes('/app')) {
    await page.getByLabel('Username').fill('Cody');
    await page.getByRole('button', { name: 'Log in' }).click();
    await sleep(1800);
  }
}

async function getAssigneeNames(page) {
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create work order' }) }).first();
  await form.waitFor({ state: 'visible', timeout: 30000 });
  const labels = await form.locator('label').allTextContents();
  const choices = labels.map(clean).filter((t) => /\((owner|manager|worker|seasonal worker)\)/i.test(t));
  return choices;
}

async function setAssignees(form, targetNames) {
  const labels = await form.locator('label').all();
  for (const lbl of labels) {
    const text = clean(await lbl.innerText());
    const box = lbl.locator('input[type="checkbox"]');
    if ((await box.count()) === 0) continue;
    const should = targetNames.some((t) => text.toLowerCase().includes(t.toLowerCase()));
    if (should) {
      await box.check({ force: true }).catch(async () => { await lbl.click(); });
    } else {
      await box.uncheck({ force: true }).catch(() => {});
    }
  }
}

async function createOrder(page, data, assignees) {
  await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1200);
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create work order' }) }).first();
  await form.waitFor({ state: 'visible', timeout: 30000 });

  await form.getByLabel('Title').fill(data.title);
  await form.getByLabel('Description').fill(data.description);
  await form.getByLabel('Status').selectOption(data.status || 'open');
  await form.getByLabel('Priority').selectOption(data.priority || 'normal');
  const due = form.getByLabel('Due date (optional)');
  if (data.dueAt) await due.fill(data.dueAt); else await due.fill('');

  await setAssignees(form, assignees);
  await form.getByRole('button', { name: 'Create work order' }).click();
  await sleep(1700);

  await page.goto(`${baseUrl}/app/work-orders?status=all&q=${encodeURIComponent(data.title)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const row = page.locator('tbody tr').filter({ hasText: data.title }).first();
  const found = await row.count();
  result.actions.push({ type: 'create', title: data.title, found: found > 0 });
  if (!found) {
    const body = clean(await page.locator('body').innerText());
    result.bugs.push({ area: '/app/work-orders', title: `Created order not found in table`, observed: { order: data.title, body: body.slice(0, 260) } });
  }
}

async function editMistake(page, mistakenTitle, correctedTitle) {
  await page.goto(`${baseUrl}/app/work-orders?status=all&q=${encodeURIComponent(mistakenTitle)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1200);
  const row = page.locator('tbody tr').filter({ hasText: mistakenTitle }).first();
  if ((await row.count()) === 0) {
    result.bugs.push({ area: '/app/work-orders', title: 'Mistake order missing before edit', observed: mistakenTitle });
    return;
  }
  await row.getByRole('link', { name: 'Edit' }).click();
  await sleep(1200);

  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save work order' }) }).first();
  await form.waitFor({ state: 'visible', timeout: 30000 });
  await form.getByLabel('Title').fill(correctedTitle);
  await form.getByLabel('Status').selectOption('cancelled');
  await form.getByLabel('Description').fill('Mistaken entry corrected and cancelled.');
  await form.getByRole('button', { name: 'Save work order' }).click();
  await sleep(1700);

  const hasDelete = (await page.getByRole('button', { name: /delete|remove/i }).count()) +
    (await page.getByRole('link', { name: /delete|remove/i }).count());
  result.actions.push({ type: 'delete_control_present', count: hasDelete });
  if (!hasDelete) {
    result.ux.push('No delete/remove control found on work order detail page for mistaken entries.');
  }

  await page.getByRole('link', { name: 'Back to work orders' }).click();
  await sleep(1000);

  await page.goto(`${baseUrl}/app/work-orders?status=cancelled&q=${encodeURIComponent(correctedTitle)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const found = await page.locator('tbody tr').filter({ hasText: correctedTitle }).count();
  result.actions.push({ type: 'edit_mistake_verify', correctedTitle, found: found > 0 });
}

async function createRecurringTemplate(page, templateName, workTitle, assignees) {
  await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1400);

  const tform = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save template' }) }).first();
  await tform.waitFor({ state: 'visible', timeout: 30000 });

  await tform.getByLabel('Template name').fill(templateName);
  await tform.getByLabel('Work order title').fill(workTitle);
  await tform.getByLabel('Description').fill('Recurring daily template for water check.');
  await tform.getByLabel('Priority').selectOption('normal');

  const labels = await tform.locator('label').all();
  for (const lbl of labels) {
    const text = clean(await lbl.innerText());
    const box = lbl.locator('input[type="checkbox"]');
    if ((await box.count()) === 0) continue;
    const should = assignees.some((a) => text.toLowerCase().includes(a.toLowerCase()));
    if (should) {
      await box.check({ force: true }).catch(async () => { await lbl.click(); });
    } else {
      await box.uncheck({ force: true }).catch(() => {});
    }
  }

  await tform.getByRole('button', { name: 'Save template' }).click();
  await sleep(1800);

  const card = page.locator('div.rounded-xl.border.bg-surface.p-3').filter({ hasText: `${templateName}: ${workTitle}` }).first();
  const exists = await card.count();
  result.actions.push({ type: 'template_create', templateName, exists: exists > 0 });
  if (!exists) {
    result.bugs.push({ area: '/app/work-orders templates', title: 'Template not visible after create', observed: templateName });
    return;
  }

  const recForm = card.locator('form').nth(1);
  const recurring = recForm.locator('input[name="recurringEnabled"]');
  if ((await recurring.count()) > 0) {
    await recurring.check({ force: true }).catch(async () => { await recForm.getByText('Recurring').click(); });
  }
  await recForm.locator('select[name="recurrenceCadence"]').selectOption('daily');
  const nextDate = dt(-1).slice(0, 10);
  await recForm.locator('input[name="nextGenerationOn"]').fill(nextDate);
  await recForm.getByRole('button', { name: 'Save' }).click();
  await sleep(1800);

  result.actions.push({ type: 'template_set_recurring', templateName, cadence: 'daily', nextDate });

  const createNowForm = card.locator('form').nth(0);
  await createNowForm.getByRole('button', { name: 'Create now' }).click();
  await sleep(1700);
  result.actions.push({ type: 'template_create_now_clicked', templateName });
}

async function collectFinalState(page) {
  await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1200);
  await snap(page, 'final-workorders-all');
  const rows = await page.locator('tbody tr').all();
  const items = [];
  for (const row of rows) {
    const c = (await row.locator('td').allTextContents()).map(clean);
    items.push({ title: c[0] || '', status: c[1] || '', priority: c[2] || '', assignees: c[3] || '', due: c[4] || '' });
  }

  const tabs = await page.locator('a.rounded-full.border').allTextContents().then((a) => a.map(clean)).catch(() => []);

  await page.goto(`${baseUrl}/app/work-orders?status=cancelled`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  await snap(page, 'final-workorders-cancelled');

  return { items, tabs };
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  try {
    await login(page);
    await snap(page, 'after-login');

    await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1300);

    const allAssignees = await getAssigneeNames(page);
    const manager = allAssignees.find((a) => /\(manager\)/i.test(a));
    const workers = allAssignees.filter((a) => /\(worker|seasonal worker\)/i.test(a));
    const owner = allAssignees.find((a) => /\(owner\)/i.test(a));
    const assignees = [manager, ...workers.slice(0, 3)].filter(Boolean);
    if (!assignees.length && owner) assignees.push(owner);
    result.actions.push({ type: 'assignee_selection', assignees, allAssignees });

    const orders = [
      {
        title: `Water Check - North Trough ${rid}`,
        description: 'Check water flow and clean trough debris.',
        priority: 'normal',
        dueAt: dt(0, 10, 0),
      },
      {
        title: `Feed Check - Winter Lot ${rid}`,
        description: 'Confirm hay quantity and feed bunks are full.',
        priority: 'normal',
        dueAt: dt(1, 7, 30),
      },
      {
        title: `Fence Repair - Creek Lot ${rid}`,
        description: 'Repair loose wire and posts by creek crossing.',
        priority: 'high',
        dueAt: dt(1, 16, 0),
      },
      {
        title: `Animal Health Check - Calves ${rid}`,
        description: 'Visual calf health check for respiratory signs and limping.',
        priority: 'normal',
        dueAt: dt(2, 9, 0),
      },
      {
        title: `Move and Check Cattle - Lower Field ${rid}`,
        description: 'Move herd group and verify final headcount against sheet.',
        priority: 'high',
        dueAt: dt(-2, 8, 0),
      },
      {
        title: `MISTAKE Duplicate Feed Entry ${rid}`,
        description: 'Intentional mistaken entry for owner recovery test.',
        priority: 'low',
        dueAt: dt(3, 8, 0),
      },
    ];

    for (const order of orders) {
      await createOrder(page, order, assignees);
    }

    await createRecurringTemplate(page, `Recurring Water Patrol ${rid}`, `Recurring Water Check ${rid}`, assignees);

    await editMistake(page, `MISTAKE Duplicate Feed Entry ${rid}`, `Corrected Feed Entry ${rid}`);

    const finalState = await collectFinalState(page);
    result.final = finalState;

    const summary = path.join(outDir, 'summary.json');
    fs.writeFileSync(summary, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ok: true, outDir, summary }, null, 2));
  } catch (e) {
    result.fatal = e instanceof Error ? e.message : String(e);
    const summary = path.join(outDir, 'summary.json');
    fs.writeFileSync(summary, JSON.stringify(result, null, 2));
    console.error(JSON.stringify({ ok: false, outDir, summary, error: result.fatal }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
