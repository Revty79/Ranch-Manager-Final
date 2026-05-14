const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://208.88.9.175:3002';
const outDir = path.join(process.cwd(), 'test-artifacts', `resume-owner-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });

const rid = String(Date.now()).slice(-6);
const stamp = new Date().toISOString();

const result = {
  startedAt: stamp,
  runId: rid,
  urls: {},
  currentState: {},
  actions: [],
  bugs: [],
  ux: [],
  screenshots: [],
};

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function daysFromToday(daysOffset, hour = 8, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, minute, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

async function snap(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  result.screenshots.push({ name, file });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(page) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.getByLabel('Username').fill('cody');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Log in' }).click();
  await wait(1800);
  if (!page.url().includes('/app')) {
    await page.getByLabel('Username').fill('Cody');
    await page.getByRole('button', { name: 'Log in' }).click();
    await wait(1800);
  }
  result.urls.afterLogin = page.url();
}

async function getTableRows(page) {
  const rows = await page.locator('tbody tr').all();
  const data = [];
  for (const row of rows) {
    const cells = await row.locator('td').allTextContents();
    data.push(cells.map((x) => clean(x)));
  }
  return data;
}

async function scanSettings(page) {
  await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(1200);
  result.urls.settings = page.url();
  await snap(page, '01-settings');

  const body = clean(await page.locator('body').innerText());
  const ranchMatch = body.match(/Ranch:\s*([^\n]+?)\s+Current user:/i);
  const userMatch = body.match(/Current user:\s*([^\n]+?)\s+Role:/i);
  const roleMatch = body.match(/Role:\s*(owner|manager|worker|seasonal_worker)/i);

  result.currentState.profile = {
    ranchName: ranchMatch ? clean(ranchMatch[1]) : null,
    currentUser: userMatch ? clean(userMatch[1]) : null,
    role: roleMatch ? clean(roleMatch[1]) : null,
  };
}

async function scanTeam(page) {
  await page.goto(`${baseUrl}/app/team?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(1200);
  result.urls.team = page.url();
  await snap(page, '02-team');

  const rows = await getTableRows(page);
  const members = rows.map((cells) => ({
    name: cells[0] || '',
    username: cells[1] || '',
    role: cells[2] || '',
    pay: cells[3] || '',
    status: cells[5] || '',
  }));

  const managerCount = members.filter((m) => /manager/i.test(m.role)).length;
  const workerCount = members.filter((m) => /worker/i.test(m.role)).length;

  result.currentState.team = {
    totalVisible: members.length,
    managerCount,
    workerCount,
    members,
  };
}

async function scanHerd(page) {
  await page.goto(`${baseUrl}/app/herd`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(1400);
  result.urls.herd = page.url();
  await snap(page, '03-herd');

  const rows = await getTableRows(page);
  const animals = rows.map((cells) => ({
    tagAndInternal: cells[0] || '',
    name: cells[1] || '',
    speciesClass: cells[2] || '',
    sex: cells[3] || '',
    status: cells[4] || '',
    location: cells[5] || '',
  }));

  const visibleText = clean(await page.locator('body').innerText());
  const totalMatch = visibleText.match(/Total\s+(\d+)\s+All registry records/i);
  const activeMatch = visibleText.match(/Active\s+(\d+)\s+Ready for operations/i);

  result.currentState.herd = {
    totalFromStats: totalMatch ? Number(totalMatch[1]) : null,
    activeFromStats: activeMatch ? Number(activeMatch[1]) : null,
    rowsVisible: animals.length,
    sample: animals.slice(0, 20),
  };
}

async function scanLand(page) {
  await page.goto(`${baseUrl}/app/land`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(1400);
  result.urls.land = page.url();
  await snap(page, '04-land');

  const rows = await getTableRows(page);
  const units = rows.map((cells) => ({
    nameAndCode: cells[0] || '',
    type: cells[1] || '',
    acreage: cells[2] || '',
    occupancy: cells[4] || '',
    status: cells[6] || '',
  }));

  result.currentState.land = {
    rowsVisible: units.length,
    units,
  };
}

async function scanWorkOrders(page, label = '05-work-orders-before') {
  await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(1600);
  result.urls.workOrders = page.url();
  await snap(page, label);

  const body = clean(await page.locator('body').innerText());
  const hasSectionError = /Unable to load this app section/i.test(body);
  const rows = await getTableRows(page);
  const orders = rows.map((cells) => ({
    title: cells[0] || '',
    status: cells[1] || '',
    priority: cells[2] || '',
    assignees: cells[3] || '',
    due: cells[4] || '',
    pay: cells[5] || '',
    review: cells[6] || '',
  }));

  const templateCards = await page
    .locator('div.rounded-xl.border.bg-surface.p-3 p.font-semibold')
    .allTextContents()
    .catch(() => []);

  return {
    hasSectionError,
    orders,
    templateTitles: templateCards.map((t) => clean(t)),
    assigneeChoices: await page
      .locator('form:has(button:has-text("Create work order")) label')
      .allTextContents()
      .then((arr) => arr.map((x) => clean(x)).filter(Boolean))
      .catch(() => []),
  };
}

async function setAssignees(createForm, namesToUse) {
  const labels = await createForm.locator('label').all();
  for (const lbl of labels) {
    const text = clean(await lbl.innerText());
    const shouldCheck = namesToUse.some((n) => text.toLowerCase().includes(n.toLowerCase()));
    const box = lbl.locator('input[type="checkbox"]');
    if ((await box.count()) === 0) continue;
    if (shouldCheck) {
      await box.check({ force: true }).catch(async () => {
        await lbl.click();
      });
    } else {
      await box.uncheck({ force: true }).catch(() => {});
    }
  }
}

async function createWorkOrder(page, payload) {
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create work order' }) }).first();

  await form.getByLabel('Title').fill(payload.title);
  await form.getByLabel('Description').fill(payload.description || '');
  await form.getByLabel('Status').selectOption(payload.status || 'open');
  await form.getByLabel('Priority').selectOption(payload.priority || 'normal');

  const due = form.getByLabel('Due date (optional)');
  if (payload.dueAt) {
    await due.fill(payload.dueAt);
  } else {
    await due.fill('');
  }

  if (payload.assigneeNames && payload.assigneeNames.length) {
    await setAssignees(form, payload.assigneeNames);
  }

  await form.getByRole('button', { name: 'Create work order' }).click();
  await wait(1600);

  const text = clean(await form.innerText());
  const ok = /Work order created\./i.test(text);
  result.actions.push({ type: 'createWorkOrder', title: payload.title, ok, formText: text.slice(0, 280) });

  if (!ok) {
    result.bugs.push({
      area: '/app/work-orders create form',
      title: `Work order create feedback missing for ${payload.title}`,
      observed: text.slice(0, 400),
    });
  }
}

async function createTemplateAndSetRecurring(page, payload) {
  const templateForm = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save template' }) })
    .first();

  await templateForm.getByLabel('Template name').fill(payload.templateName);
  await templateForm.getByLabel('Work order title').fill(payload.workTitle);
  await templateForm.getByLabel('Description').fill(payload.description || '');
  await templateForm.getByLabel('Priority').selectOption(payload.priority || 'normal');

  if (payload.assigneeNames && payload.assigneeNames.length) {
    const labels = await templateForm.locator('label').all();
    for (const lbl of labels) {
      const text = clean(await lbl.innerText());
      const box = lbl.locator('input[type="checkbox"]');
      if ((await box.count()) === 0) continue;
      const shouldCheck = payload.assigneeNames.some((n) => text.toLowerCase().includes(n.toLowerCase()));
      if (shouldCheck) {
        await box.check({ force: true }).catch(async () => {
          await lbl.click();
        });
      } else {
        await box.uncheck({ force: true }).catch(() => {});
      }
    }
  }

  await templateForm.getByRole('button', { name: 'Save template' }).click();
  await wait(1800);
  const formText = clean(await templateForm.innerText());
  const ok = /Template created\./i.test(formText);
  result.actions.push({ type: 'createTemplate', templateName: payload.templateName, ok, formText: formText.slice(0, 280) });

  const card = page.locator('div.rounded-xl.border.bg-surface.p-3').filter({ hasText: `${payload.templateName}: ${payload.workTitle}` }).first();
  if ((await card.count()) === 0) {
    result.bugs.push({
      area: '/app/work-orders template list',
      title: 'New template row not visible after create',
      observed: payload.templateName,
    });
    return;
  }

  const recurrenceForm = card.locator('form').nth(1);

  const recurringCheckbox = recurrenceForm.locator('input[name="recurringEnabled"]');
  if ((await recurringCheckbox.count()) > 0) {
    await recurringCheckbox.check({ force: true }).catch(async () => {
      await recurrenceForm.getByText('Recurring').click();
    });
  }
  const cadence = recurrenceForm.locator('select[name="recurrenceCadence"]');
  if ((await cadence.count()) > 0) await cadence.selectOption('daily');

  const nextDateInput = recurrenceForm.locator('input[name="nextGenerationOn"]');
  const dateOnly = daysFromToday(-1).slice(0, 10);
  if ((await nextDateInput.count()) > 0) await nextDateInput.fill(dateOnly);

  await recurrenceForm.getByRole('button', { name: 'Save' }).click();
  await wait(1800);

  result.actions.push({
    type: 'setTemplateRecurring',
    templateName: payload.templateName,
    cadence: 'daily',
    nextGenerationOn: dateOnly,
    ok: true,
  });

  const createNowForm = card.locator('form').nth(0);
  await createNowForm.getByRole('button', { name: 'Create now' }).click();
  await wait(1600);
  result.actions.push({ type: 'createFromTemplate', templateName: payload.templateName, ok: true });
}

async function editMistakeAndTestDelete(page, mistakenTitle, correctedTitle) {
  await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await wait(1200);

  const row = page.locator('tbody tr').filter({ hasText: mistakenTitle }).first();
  if ((await row.count()) === 0) {
    result.bugs.push({
      area: '/app/work-orders table',
      title: 'Mistaken work order row not found for edit test',
      observed: mistakenTitle,
    });
    return;
  }

  await row.getByRole('link', { name: 'Edit' }).click();
  await wait(1200);
  await snap(page, '06-mistake-detail-before-edit');

  const detailForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save work order' }) }).first();
  await detailForm.getByLabel('Title').fill(correctedTitle);
  await detailForm.getByLabel('Status').selectOption('cancelled');
  await detailForm.getByLabel('Description').fill('Originally created by mistake. Corrected and cancelled for clean records.');
  await detailForm.getByRole('button', { name: 'Save work order' }).click();
  await wait(1700);

  const formText = clean(await detailForm.innerText());
  const editOk = /Work order updated\./i.test(formText);
  result.actions.push({ type: 'editMistakenOrder', from: mistakenTitle, to: correctedTitle, ok: editOk, formText: formText.slice(0, 280) });

  const deleteButtonCount = (await page.getByRole('button', { name: /delete|remove/i }).count()) +
    (await page.getByRole('link', { name: /delete|remove/i }).count());

  if (deleteButtonCount === 0) {
    result.actions.push({ type: 'deleteMistakenOrder', supported: false, note: 'No delete/remove control found on work order detail page.' });
    result.ux.push('No obvious delete/remove action for mistaken work orders; owner can only edit/cancel, which makes cleanup less clear.');
  } else {
    result.actions.push({ type: 'deleteMistakenOrder', supported: true, note: 'Delete/remove control exists (not executed automatically).' });
  }

  await page.getByRole('link', { name: 'Back to work orders' }).click();
  await wait(1200);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('dialog', async (dialog) => {
    await dialog.accept().catch(() => {});
  });

  page.on('pageerror', (err) => {
    result.bugs.push({ area: 'browser pageerror', title: 'Unhandled page error', observed: err.message });
  });

  try {
    await login(page);
    await snap(page, '00-after-login');

    await scanSettings(page);
    await scanTeam(page);
    await scanHerd(page);
    await scanLand(page);

    const before = await scanWorkOrders(page, '05-work-orders-before');
    result.currentState.workOrders = before;

    if (before.hasSectionError) {
      result.bugs.push({
        area: '/app/work-orders',
        title: 'Work-orders page still showing section load error',
        observed: 'Unable to load this app section present',
      });
    }

    const assignees = before.assigneeChoices;
    const managerNames = assignees.filter((x) => /\(manager\)/i.test(x));
    const workerNames = assignees.filter((x) => /\(worker|seasonal worker\)/i.test(x));
    const ownerNames = assignees.filter((x) => /\(owner\)/i.test(x));

    const preferredAssignees = [
      ...(managerNames.length ? [managerNames[0]] : []),
      ...workerNames.slice(0, 3),
    ];

    if (preferredAssignees.length === 0 && ownerNames.length) {
      preferredAssignees.push(ownerNames[0]);
      result.ux.push('Could not find worker/manager assignees in create form; used owner assignment fallback.');
    }

    await createWorkOrder(page, {
      title: `Water Check - North Trough ${rid}`,
      description: 'Check water level and flow in North Pasture troughs before noon.',
      priority: 'normal',
      status: 'open',
      dueAt: daysFromToday(0, 10, 0),
      assigneeNames: preferredAssignees,
    });

    await createWorkOrder(page, {
      title: `Feed Check - Winter Lot ${rid}`,
      description: 'Verify hay inventory and feed bunks in Winter Lot.',
      priority: 'normal',
      status: 'open',
      dueAt: daysFromToday(1, 7, 30),
      assigneeNames: preferredAssignees,
    });

    await createWorkOrder(page, {
      title: `Fence Repair - Creek Lot ${rid}`,
      description: 'Repair sagging west fence section near creek crossing.',
      priority: 'high',
      status: 'open',
      dueAt: daysFromToday(1, 16, 0),
      assigneeNames: preferredAssignees,
    });

    await createWorkOrder(page, {
      title: `Animal Health Check - Calves ${rid}`,
      description: 'Visual check for cough, limp, and appetite changes in calf group.',
      priority: 'normal',
      status: 'open',
      dueAt: daysFromToday(2, 9, 0),
      assigneeNames: preferredAssignees,
    });

    await createWorkOrder(page, {
      title: `Move and Check Cattle - Lower Field ${rid}`,
      description: 'Move cattle to Lower Field and confirm headcount after movement.',
      priority: 'high',
      status: 'open',
      dueAt: daysFromToday(-2, 8, 0),
      assigneeNames: preferredAssignees,
    });

    const mistakenTitle = `MISTAKE Duplicate Feed Entry ${rid}`;
    const correctedTitle = `Corrected Feed Entry ${rid}`;

    await createWorkOrder(page, {
      title: mistakenTitle,
      description: 'Intentional mistaken entry for edit/delete recovery test.',
      priority: 'low',
      status: 'open',
      dueAt: daysFromToday(3, 8, 0),
      assigneeNames: preferredAssignees,
    });

    await createTemplateAndSetRecurring(page, {
      templateName: `Recurring Water Patrol ${rid}`,
      workTitle: `Recurring Water Check ${rid}`,
      description: 'Daily recurring template for trough checks in active units.',
      priority: 'normal',
      assigneeNames: preferredAssignees,
    });

    await editMistakeAndTestDelete(page, mistakenTitle, correctedTitle);

    await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await wait(1400);
    await snap(page, '07-work-orders-after');

    const afterRows = await getTableRows(page);
    result.currentState.workOrdersAfter = afterRows.map((cells) => ({
      title: cells[0] || '',
      status: cells[1] || '',
      priority: cells[2] || '',
      assignees: cells[3] || '',
      due: cells[4] || '',
    }));

    const statusTabTexts = await page
      .locator('a.rounded-full.border')
      .allTextContents()
      .then((arr) => arr.map((x) => clean(x)))
      .catch(() => []);

    result.currentState.statusTabs = statusTabTexts;

    await page.goto(`${baseUrl}/app/work-orders?status=open`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await wait(900);
    await snap(page, '08-work-orders-open-filter');

    await page.goto(`${baseUrl}/app/work-orders?status=cancelled`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await wait(900);
    await snap(page, '09-work-orders-cancelled-filter');

    const cancelledRows = await getTableRows(page);
    result.currentState.cancelledRows = cancelledRows.map((cells) => ({
      title: cells[0] || '',
      status: cells[1] || '',
      priority: cells[2] || '',
    }));

    const summaryPath = path.join(outDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ok: true, outDir, summaryPath }, null, 2));
  } catch (error) {
    const summaryPath = path.join(outDir, 'summary.json');
    result.fatalError = error instanceof Error ? error.message : String(error);
    fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));
    console.error(JSON.stringify({ ok: false, outDir, summaryPath, error: result.fatalError }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
