const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://208.88.9.175:3002';
const username = 'aubrey-mgr-162225';
const passwordCandidates = ['RanchMgr#2026!', 'RanchPass123!'];
const forcedNewPassword = 'RanchMgr#2026!';

const runId = String(Date.now()).slice(-6);
const outDir = path.join(process.cwd(), 'test-artifacts', `manager-qa-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });

const result = {
  runId,
  startedAt: new Date().toISOString(),
  manager: { username },
  login: {},
  visibility: {},
  workflow: {
    reviewedTasks: [],
    createdTasks: [],
    reassignedTasks: [],
    statusUpdates: [],
    mistakesCorrected: [],
  },
  blockers: [],
  bugs: [],
  permissionChecks: [],
  uxFriction: [],
  cleanupObservations: [],
  mobile: {},
  artifacts: [],
};

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function dateTimeLocal(daysOffset, hour = 8, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  d.setHours(hour, minute, 0, 0);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function screenshot(page, name) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  result.artifacts.push({ type: 'screenshot', name, file });
}

async function loginManager(page) {
  for (const pass of passwordCandidates) {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(pass);
    await page.getByRole('button', { name: 'Log in' }).click();
    await sleep(1800);

    if (page.url().includes('/reset-password')) {
      await page.locator('input[name="newPassword"]').fill(forcedNewPassword);
      await page.locator('input[name="confirmPassword"]').fill(forcedNewPassword);
      await page.getByRole('button', { name: 'Save new password' }).click();
      await sleep(1800);
      result.login.passwordResetTriggered = true;
      result.login.passwordSetTo = forcedNewPassword;
    }

    if (page.url().includes('/app')) {
      result.login.success = true;
      result.login.passwordUsed = pass;
      result.login.finalUrl = page.url();
      return;
    }

    const bodyText = clean(await page.locator('body').innerText().catch(() => ''));
    if (/Invalid username or password/i.test(bodyText)) {
      continue;
    }
  }

  result.login.success = false;
  result.blockers.push('Manager login failed with available credentials.');
  throw new Error('Manager login failed');
}

async function getRows(page) {
  const rows = await page.locator('tbody tr').all();
  const out = [];
  for (const row of rows) {
    const cells = (await row.locator('td').allTextContents()).map(clean);
    out.push(cells);
  }
  return out;
}

async function setAssigneesInEditForm(form, namesToKeep) {
  const labels = await form.locator('label').all();
  for (const label of labels) {
    const text = clean(await label.innerText());
    const box = label.locator('input[type="checkbox"]');
    if ((await box.count()) === 0) continue;

    const shouldCheck = namesToKeep.some((name) => text.toLowerCase().includes(name.toLowerCase()));
    if (shouldCheck) {
      await box.check({ force: true }).catch(async () => {
        await label.click();
      });
    } else {
      await box.uncheck({ force: true }).catch(() => {});
    }
  }
}

async function openWorkOrderEdit(page, title) {
  await page.goto(`${baseUrl}/app/work-orders?status=all&q=${encodeURIComponent(title)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await sleep(1200);

  const row = page.locator('tbody tr').filter({ hasText: title }).first();
  if ((await row.count()) === 0) {
    result.bugs.push({
      page: '/app/work-orders',
      steps: `Search for ${title} and open Edit`,
      expected: 'Task row exists and can be edited',
      actual: 'Task row not found in filtered list',
      severity: 'medium',
      likelyCodeArea: 'lib/work-orders/queries.ts or app/(app)/app/work-orders/page.tsx',
    });
    return false;
  }

  await row.getByRole('link', { name: 'Edit' }).click();
  await sleep(1200);
  return true;
}

async function checkVisibilityAndPermissions(page) {
  const pagesToCheck = [
    '/app',
    '/app/work-orders?status=all',
    '/app/today',
    '/app/needs-attention',
    '/app/team?status=all',
    '/app/herd',
    '/app/land',
    '/app/payroll',
    '/app/settings',
  ];

  for (const route of pagesToCheck) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(900);
    const body = clean(await page.locator('body').innerText());
    result.visibility[route] = {
      url: page.url(),
      hasAccessDenied: /access denied|not authorized|no ranch access/i.test(body),
      hasSectionError: /Unable to load this app section/i.test(body),
      sample: body.slice(0, 220),
    };
  }

  await screenshot(page, '01-settings-manager');

  // Owner-only checks
  await page.goto(`${baseUrl}/admin`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(900);
  const adminBody = clean(await page.locator('body').innerText());
  result.permissionChecks.push({
    check: 'manager_access_admin',
    route: '/admin',
    finalUrl: page.url(),
    allowed: !/access denied|not authorized|no ranch access/i.test(adminBody) && !page.url().includes('/access-denied'),
    sample: adminBody.slice(0, 200),
  });
  await screenshot(page, '02-admin-access-check');

  await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(900);
  const settingsBody = clean(await page.locator('body').innerText());
  const hasBillingControls = /Start Stripe checkout|Open Stripe Customer Portal|Allow admin access|Block admin access/i.test(settingsBody);
  result.permissionChecks.push({
    check: 'manager_owner_controls_visibility',
    route: '/app/settings',
    hasOwnerControlsVisible: hasBillingControls,
    sample: settingsBody.slice(0, 260),
  });

  await page.goto(`${baseUrl}/checkout`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(900);
  const checkoutBody = clean(await page.locator('body').innerText());
  result.permissionChecks.push({
    check: 'manager_direct_checkout_route',
    route: '/checkout',
    finalUrl: page.url(),
    blocked: /access denied|not authorized|billing controls are owner-only|owner/i.test(checkoutBody) || page.url().includes('/access-denied'),
    sample: checkoutBody.slice(0, 200),
  });
  await screenshot(page, '03-checkout-access-check');
}

async function reviewWorkOrders(page) {
  await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1200);
  await screenshot(page, '04-workorders-all-initial');

  const allRows = await getRows(page);
  result.workflow.reviewedTasks = allRows.slice(0, 20).map((cells) => ({
    title: cells[0] || '',
    status: cells[1] || '',
    priority: cells[2] || '',
    assignees: cells[3] || '',
    due: cells[4] || '',
  }));

  // Check cancelled view clarity
  await page.goto(`${baseUrl}/app/work-orders?status=cancelled`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(900);
  await screenshot(page, '05-workorders-cancelled');
  const cancelledRows = await getRows(page);
  result.workflow.cancelledViewCount = cancelledRows.length;
  result.workflow.cancelledSample = cancelledRows.slice(0, 10).map((cells) => cells[0] || '');

  // Check completed view
  await page.goto(`${baseUrl}/app/work-orders?status=completed`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(900);
  await screenshot(page, '06-workorders-completed-before');
  const completedRows = await getRows(page);
  result.workflow.completedViewCountBefore = completedRows.length;

  // Recurring-generated perspective
  await page.goto(`${baseUrl}/app/work-orders?status=all&q=${encodeURIComponent('Recurring Water Check 411116')}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await sleep(1000);
  const recurringRows = await getRows(page);
  result.workflow.recurringRowsCount = recurringRows.length;
  result.workflow.recurringRows = recurringRows.map((cells) => ({
    title: cells[0] || '',
    status: cells[1] || '',
    due: cells[4] || '',
    assignees: cells[3] || '',
  }));
  await screenshot(page, '07-recurring-search');

  // Overdue visibility check
  await page.goto(`${baseUrl}/app/work-orders?status=all&q=${encodeURIComponent('Move and Check Cattle - Lower Field 411116')}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await sleep(1000);
  const overdueRows = await getRows(page);
  result.workflow.overdueRows = overdueRows.map((cells) => ({
    title: cells[0] || '',
    status: cells[1] || '',
    due: cells[4] || '',
  }));
  await screenshot(page, '08-overdue-search');
}

async function createAndManageTasks(page) {
  await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1200);

  const createForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create work order' }) }).first();
  await createForm.waitFor({ state: 'visible', timeout: 30000 });

  // Create urgent task for Ty
  const urgentTitle = `Urgent Fence Repair Manager ${runId}`;
  await createForm.getByLabel('Title').fill(urgentTitle);
  await createForm.getByLabel('Description').fill('Urgent: secure broken fence segment and prevent cattle escape.');
  await createForm.getByLabel('Status').selectOption('open');
  await createForm.getByLabel('Priority').selectOption('high');
  await createForm.getByLabel('Due date (optional)').fill(dateTimeLocal(0, 17, 0));
  await setAssigneesInEditForm(createForm, ['Ty Brooks Badtech 170111']);
  await createForm.getByRole('button', { name: 'Create work order' }).click();
  await sleep(1500);

  await page.goto(`${baseUrl}/app/work-orders?status=all&q=${encodeURIComponent(urgentTitle)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const urgentRow = page.locator('tbody tr').filter({ hasText: urgentTitle }).first();
  if ((await urgentRow.count()) === 0) {
    result.blockers.push('Could not verify newly created urgent task in work-order list.');
  } else {
    const rowText = clean(await urgentRow.innerText());
    result.workflow.createdTasks.push({ title: urgentTitle, row: rowText });
  }

  // Create/update task related to checking water
  await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const createForm2 = page.locator('form').filter({ has: page.getByRole('button', { name: 'Create work order' }) }).first();
  await createForm2.getByLabel('Title').fill(`Water Line Audit Manager ${runId}`);
  await createForm2.getByLabel('Description').fill('Inspect water line pressure and check all trough valves.');
  await createForm2.getByLabel('Status').selectOption('open');
  await createForm2.getByLabel('Priority').selectOption('normal');
  await createForm2.getByLabel('Due date (optional)').fill(dateTimeLocal(1, 9, 30));
  await setAssigneesInEditForm(createForm2, ['Reed Dalton Reliable 162225']);
  await createForm2.getByRole('button', { name: 'Create work order' }).click();
  await sleep(1500);

  const waterTitle = `Water Line Audit Manager ${runId}`;
  await page.goto(`${baseUrl}/app/work-orders?status=all&q=${encodeURIComponent(waterTitle)}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const waterRow = page.locator('tbody tr').filter({ hasText: waterTitle }).first();
  if ((await waterRow.count()) > 0) {
    result.workflow.createdTasks.push({ title: waterTitle, row: clean(await waterRow.innerText()) });
  }

  // Reassign one task from Reed to Lane
  const reassignTarget = 'Feed Check - Winter Lot 411116';
  const opened = await openWorkOrderEdit(page, reassignTarget);
  if (opened) {
    const editForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save work order' }) }).first();
    await editForm.waitFor({ state: 'visible', timeout: 30000 });

    await setAssigneesInEditForm(editForm, ['Milo Test Worker 783163', 'Lane Morris Forgetful 170111']);
    await editForm.getByRole('button', { name: 'Save work order' }).click();
    await sleep(1500);

    await page.goto(`${baseUrl}/app/work-orders?status=all&q=${encodeURIComponent(reassignTarget)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await sleep(1000);
    const row = page.locator('tbody tr').filter({ hasText: reassignTarget }).first();
    if ((await row.count()) > 0) {
      const rowText = clean(await row.innerText());
      result.workflow.reassignedTasks.push({ title: reassignTarget, row: rowText });
    }
  }

  // Correct mistaken assignment on water task: move from Reed -> Lane
  const waterOpen = await openWorkOrderEdit(page, waterTitle);
  if (waterOpen) {
    const editForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save work order' }) }).first();
    await setAssigneesInEditForm(editForm, ['Lane Morris Forgetful 170111']);
    await editForm.getByRole('button', { name: 'Save work order' }).click();
    await sleep(1400);
    result.workflow.mistakesCorrected.push({
      task: waterTitle,
      action: 'Corrected mistaken assignment from Reed to Lane',
    });
  }

  // Move urgent task to in-progress then completed
  const urgentOpen = await openWorkOrderEdit(page, urgentTitle);
  if (urgentOpen) {
    const editForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save work order' }) }).first();
    await editForm.getByLabel('Status').selectOption('in_progress');
    await editForm.getByRole('button', { name: 'Save work order' }).click();
    await sleep(1400);
    result.workflow.statusUpdates.push({ task: urgentTitle, status: 'in_progress' });

    await editForm.getByLabel('Status').selectOption('completed');
    await editForm.getByRole('button', { name: 'Save work order' }).click();
    await sleep(1500);
    result.workflow.statusUpdates.push({ task: urgentTitle, status: 'completed' });
  }

  // Edit a mistaken/corrected cancelled task if allowed
  const correctedTitle = 'Corrected Feed Entry 411116';
  const correctedOpen = await openWorkOrderEdit(page, correctedTitle);
  if (correctedOpen) {
    const editForm = page.locator('form').filter({ has: page.getByRole('button', { name: 'Save work order' }) }).first();
    const desc = editForm.getByLabel('Description');
    const existing = await desc.inputValue();
    await desc.fill(`${existing}\nManager review note (${runId}): cancellation confirmed.`.trim());
    await editForm.getByRole('button', { name: 'Save work order' }).click();
    await sleep(1400);
    result.workflow.mistakesCorrected.push({
      task: correctedTitle,
      action: 'Manager could edit corrected/cancelled mistaken task and add confirmation note',
    });
  }

  // Verify completed tab includes urgent task
  await page.goto(`${baseUrl}/app/work-orders?status=completed&q=${encodeURIComponent(urgentTitle)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await sleep(1000);
  const compRows = await getRows(page);
  result.workflow.completedViewAfter = compRows.map((cells) => ({
    title: cells[0] || '',
    status: cells[1] || '',
    assignees: cells[3] || '',
    due: cells[4] || '',
  }));
  await screenshot(page, '09-workorders-completed-after');

  await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1200);
  await screenshot(page, '10-workorders-all-after-manager-actions');
}

async function mobilePass() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByLabel('Username').fill(username);
    await page.getByLabel('Password').fill(forcedNewPassword);
    await page.getByRole('button', { name: 'Log in' }).click();
    await sleep(1800);

    if (!page.url().includes('/app')) {
      await page.getByLabel('Password').fill('RanchPass123!');
      await page.getByRole('button', { name: 'Log in' }).click();
      await sleep(1800);
    }

    await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1200);
    const workBody = clean(await page.locator('body').innerText());
    const hasActionsColumn = /Actions/i.test(workBody);
    const hasEditLinks = await page.getByRole('link', { name: 'Edit' }).count();

    const mobileWorkShot = path.join(outDir, '11-mobile-workorders.png');
    await page.screenshot({ path: mobileWorkShot, fullPage: true });
    result.artifacts.push({ type: 'screenshot', name: '11-mobile-workorders', file: mobileWorkShot });

    await page.goto(`${baseUrl}/app/today`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1000);
    const todayBody = clean(await page.locator('body').innerText());
    const mobileTodayShot = path.join(outDir, '12-mobile-today.png');
    await page.screenshot({ path: mobileTodayShot, fullPage: true });
    result.artifacts.push({ type: 'screenshot', name: '12-mobile-today', file: mobileTodayShot });

    result.mobile = {
      workOrdersHasActionsLabel: hasActionsColumn,
      workOrdersEditLinkCount: hasEditLinks,
      workOrdersBodySample: workBody.slice(0, 260),
      todayBodySample: todayBody.slice(0, 260),
      finalUrlToday: page.url(),
    };
  } finally {
    await browser.close();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  page.on('pageerror', (err) => {
    result.bugs.push({
      page: 'browser runtime',
      steps: 'Normal manager navigation',
      expected: 'No unhandled page errors',
      actual: err.message,
      severity: 'medium',
      likelyCodeArea: 'unknown (client runtime)',
    });
  });

  try {
    await loginManager(page);
    await screenshot(page, '00-after-manager-login');

    await checkVisibilityAndPermissions(page);
    await reviewWorkOrders(page);
    await createAndManageTasks(page);
    await mobilePass();

    // Observations for manager confusion / cleanup
    const deleteControls = await page.getByRole('button', { name: /delete|remove|archive|void/i }).count();
    if (deleteControls === 0) {
      result.cleanupObservations.push(
        'Manager-facing work-order flow still lacks obvious delete/archive/void control for mistaken records; cancellation/edit is the only visible recovery path.',
      );
    }

    // Detect overdue visibility weakness in rows (date present without explicit overdue marker)
    const overdueSearchText = JSON.stringify(result.workflow.overdueRows || []);
    if (overdueSearchText.includes('May 12, 2026') && !/overdue/i.test(overdueSearchText)) {
      result.uxFriction.push(
        'Overdue work is not explicitly labeled as overdue in the list row; managers must infer urgency from date alone.',
      );
    }

    const summaryPath = path.join(outDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ ok: true, outDir, summaryPath }, null, 2));
  } catch (error) {
    result.fatalError = error instanceof Error ? error.message : String(error);
    const summaryPath = path.join(outDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));
    console.error(JSON.stringify({ ok: false, outDir, summaryPath, fatalError: result.fatalError }, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
