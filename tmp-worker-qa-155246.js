const { chromium, devices } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://208.88.9.175:3002';
const outDir = path.join(process.cwd(), 'test-artifacts', `worker-qa-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });

const workers = [
  { key: 'reed', persona: 'reliable', fullName: 'Reed Dalton Reliable 155246', username: 'reed-reliable-155246' },
  { key: 'lane', persona: 'forgetful', fullName: 'Lane Morris Forgetful 155246', username: 'lane-forgetful-155246' },
  { key: 'ty', persona: 'general', fullName: 'Ty Brooks Worker 298925', username: 'ty-worker-298925' },
];

const candidatePasswords = ['RanchPass123!', 'WorkerPass#2026!', 'RanchMgr#2026!'];
const defaultResetPassword = 'WorkerPass#2026!';

const result = {
  startedAt: new Date().toISOString(),
  outDir,
  workers: {},
  blockers: [],
  bugs: [],
  permissionFindings: [],
  ux: [],
  runtimeErrors: [],
  mobile: {},
};

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function screenshot(page, workerKey, name) {
  const file = path.join(outDir, `${workerKey}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  if (!result.workers[workerKey]) result.workers[workerKey] = {};
  if (!result.workers[workerKey].screenshots) result.workers[workerKey].screenshots = [];
  result.workers[workerKey].screenshots.push({ name, file });
}

function attachRuntimeLogging(page, workerKey) {
  page.on('pageerror', (error) => {
    result.runtimeErrors.push({
      workerKey,
      type: 'pageerror',
      message: String(error?.message || error),
      url: page.url(),
    });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      result.runtimeErrors.push({
        workerKey,
        type: 'console-error',
        message: msg.text(),
        url: page.url(),
      });
    }
  });
}

async function loginAs(page, worker) {
  const wr = result.workers[worker.key] = result.workers[worker.key] || { persona: worker.persona, username: worker.username };

  for (const pass of candidatePasswords) {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByLabel('Username').fill(worker.username);
    await page.getByLabel('Password').fill(pass);
    await page.getByRole('button', { name: 'Log in' }).click();
    await sleep(1800);

    if (page.url().includes('/reset-password')) {
      await page.locator('input[name="newPassword"]').fill(defaultResetPassword);
      await page.locator('input[name="confirmPassword"]').fill(defaultResetPassword);
      await page.getByRole('button', { name: 'Save new password' }).click();
      await sleep(1900);
      wr.passwordResetTriggered = true;
      wr.newPassword = defaultResetPassword;
    }

    if (page.url().includes('/app')) {
      wr.loginWorked = true;
      wr.passwordUsed = pass;
      wr.finalUrlAfterLogin = page.url();
      return true;
    }

    const body = clean(await page.locator('body').innerText().catch(() => ''));
    if (/Invalid username or password/i.test(body)) continue;
  }

  wr.loginWorked = false;
  result.blockers.push(`Login failed for ${worker.fullName} (${worker.username}).`);
  return false;
}

async function checkRouteAccess(page, workerKey, route) {
  await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(900);
  const body = clean(await page.locator('body').innerText());
  const denied = /access denied|not authorized|billing controls are owner-only|no ranch access/i.test(body) || page.url().includes('/access-denied');
  return {
    route,
    finalUrl: page.url(),
    denied,
    hasSectionError: /Unable to load this app section/i.test(body),
    sample: body.slice(0, 220),
  };
}

async function collectVisibility(page, worker) {
  const wr = result.workers[worker.key];
  wr.visibility = {};

  const routes = ['/app', '/app/today', '/app/work-orders', '/app/time', '/app/team', '/app/payroll', '/app/settings', '/app/herd', '/app/land', '/app/needs-attention', '/admin', '/checkout', '/app/work-orders/00000000-0000-0000-0000-000000000000'];
  for (const route of routes) {
    wr.visibility[route] = await checkRouteAccess(page, worker.key, route);
  }

  await screenshot(page, worker.key, 'visibility-last-route');
}

async function inspectWorkerSettings(page, worker) {
  const wr = result.workers[worker.key];
  await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1100);
  const body = clean(await page.locator('body').innerText());

  wr.settingsVisibility = {
    sample: body.slice(0, 800),
    hasBillingWords: /billing|subscription|payment|stripe|checkout/i.test(body),
    hasOwnerOnlyCopy: /owner-only|owner only|billing controls are owner-only|only the owner/i.test(body),
    hasLifetimeCopy: /lifetime/i.test(body),
    hasRequestAccessCopy: /request access|admin access failsafe/i.test(body),
    hasStripeButtons: /Start subscription|Checkout|Open billing portal|Manage subscription|Pay now/i.test(body),
  };

  await screenshot(page, worker.key, 'settings');
}

async function inspectHerdLandReadOnly(page, worker) {
  const wr = result.workers[worker.key];
  wr.herdLand = {};

  for (const route of ['/app/herd', '/app/land']) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(900);
    const body = clean(await page.locator('body').innerText());
    wr.herdLand[route] = {
      finalUrl: page.url(),
      denied: /access denied|not authorized|unable to load this app section/i.test(body) || page.url().includes('/access-denied'),
      hasCreateUi: /Add animal|Register animal|Create animal|Add land unit|Create land unit|Create pasture|Create/i.test(body),
      hasEditUi: /\bEdit\b|Update animal|Update land/i.test(body),
      sample: body.slice(0, 500),
    };
    await screenshot(page, worker.key, route === '/app/herd' ? 'herd' : 'land');
  }
}

async function getAssignedCards(page) {
  const cards = page.locator('div:has(> p.font-semibold), div.rounded-xl.border.bg-surface.p-3');
  const count = await cards.count().catch(() => 0);
  const out = [];
  for (let i = 0; i < Math.min(count, 20); i++) {
    const text = clean(await cards.nth(i).innerText().catch(() => ''));
    if (text && /Priority:|Due:|Review|Not required|Changes requested|open|in progress|completed|cancelled/i.test(text)) {
      out.push(text.slice(0, 380));
    }
  }
  return out;
}

async function readTodayAndWorkQueue(page, worker) {
  const wr = result.workers[worker.key];

  await page.goto(`${baseUrl}/app/today`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1100);
  const todayBody = clean(await page.locator('body').innerText());
  wr.todaySummary = {
    sample: todayBody.slice(0, 800),
    hasShiftControls: /Clock in|Clock out|Shift status/i.test(todayBody),
    hasWorkTimerControls: /Start work timer|Stop work timer|Complete work order|Complete selected work order/i.test(todayBody),
  };
  await screenshot(page, worker.key, 'today');

  await page.goto(`${baseUrl}/app/work-orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const woBody = clean(await page.locator('body').innerText());
  wr.workOrdersSummary = {
    sample: woBody.slice(0, 800),
    hasCreateForm: /Create work order|Template Library/i.test(woBody),
    hasEditLinks: (await page.getByRole('link', { name: 'Edit' }).count()) > 0,
    assignedCards: await getAssignedCards(page),
  };
  await screenshot(page, worker.key, 'workorders');
}

async function reliableFlow(page, worker) {
  const wr = result.workers[worker.key];
  wr.actions = wr.actions || [];

  await page.goto(`${baseUrl}/app/today`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);

  // Start shift if possible
  const clockInBtn = page.getByRole('button', { name: 'Clock in' });
  if ((await clockInBtn.count()) > 0) {
    await clockInBtn.first().click();
    await sleep(1200);
    wr.actions.push('Clocked in (if not already active).');
  }

  // Start work timer if available
  const select = page.locator('select[name="workOrderId"]').first();
  if ((await select.count()) > 0) {
    const options = await select.locator('option').allTextContents();
    const usable = options.map(clean).filter((o) => o && !/Select work order/i.test(o));
    wr.timerOptions = usable;
    if (usable.length > 0) {
      await select.selectOption({ index: 1 }).catch(async () => {
        const val = await select.locator('option').nth(1).getAttribute('value');
        if (val) await select.selectOption(val);
      });

      const startBtn = page.getByRole('button', { name: 'Start work timer' });
      if ((await startBtn.count()) > 0) {
        await startBtn.first().click();
        await sleep(1500);
        wr.actions.push('Started work timer on assigned task.');
      }
    }
  }

  // Complete current work order with messy/long note + evidence
  const completionForms = page.locator('form').filter({ has: page.getByRole('button', { name: /Complete work order|Complete selected work order/i }) });
  if ((await completionForms.count()) > 0) {
    const form = completionForms.first();
    const details = form.locator('details');
    if ((await details.count()) > 0) {
      await details.first().locator('summary').click();
      await sleep(300);
    }

    const longMessyNote = `Done-ish but with notes:\n- fixed latch\n- mud everywhere\n- had to re-tighten wire twice\n- probably needs manager follow-up on post depth\n\nMESSY LOG: ${'x '.repeat(120)}\nleft tools by gate then moved them back.`;

    const note = form.locator('textarea[name="completionNote"]');
    if ((await note.count()) > 0) {
      await note.fill(longMessyNote);
      wr.actions.push('Added long/messy completion note.');
    }

    const evidenceLabel = form.locator('input[name="evidenceLabel1"]');
    if ((await evidenceLabel.count()) > 0) {
      await evidenceLabel.fill('Photo after fence fix');
      await form.locator('input[name="evidenceUrl1"]').fill('https://example.com/fence-proof.jpg');
      await form.locator('input[name="evidenceNotes1"]').fill('Photo is blurry but shows repaired section.');
    }

    const submitBtn = form.getByRole('button', { name: /Complete work order|Complete selected work order/i }).first();
    await submitBtn.click();
    await sleep(1800);

    const formText = clean(await form.innerText());
    wr.completeFeedback = formText.slice(0, 360);
    wr.actions.push('Submitted completion proof for one assigned task.');
  } else {
    wr.actions.push('No completion form available in Today view.');
  }

  await screenshot(page, worker.key, 'reliable-after-complete');

  await page.goto(`${baseUrl}/app/work-orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  wr.assignedAfterCompletion = await getAssignedCards(page);
}

async function forgetfulFlow(page, worker) {
  const wr = result.workers[worker.key];
  wr.actions = wr.actions || [];

  await page.goto(`${baseUrl}/app/today`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);

  // Clock in if needed
  const clockIn = page.getByRole('button', { name: 'Clock in' });
  if ((await clockIn.count()) > 0) {
    await clockIn.first().click();
    await sleep(1100);
    wr.actions.push('Clocked in before starting task.');
  }

  // Start timer on one task if possible
  const select = page.locator('select[name="workOrderId"]').first();
  if ((await select.count()) > 0 && (await select.locator('option').count()) > 1) {
    await select.selectOption({ index: 1 }).catch(async () => {
      const val = await select.locator('option').nth(1).getAttribute('value');
      if (val) await select.selectOption(val);
    });
    const start = page.getByRole('button', { name: 'Start work timer' });
    if ((await start.count()) > 0) {
      await start.first().click();
      await sleep(1300);
      wr.actions.push('Started task but did not finish (forgetful scenario).');
    }
  }

  // Leaves page without completing
  await page.goto(`${baseUrl}/app/communication`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(900);
  wr.actions.push('Left Today screen without completing task.');

  // Comes back later
  await page.goto(`${baseUrl}/app/today`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1100);
  const body = clean(await page.locator('body').innerText());
  wr.returnedTodayState = {
    sample: body.slice(0, 420),
    hasActiveTimerMessage: /Tracking|Active Work Timer|Stop work timer/i.test(body),
    hasReminderLikeText: /Next best action|Finish or stop the active timer/i.test(body),
  };

  await screenshot(page, worker.key, 'forgetful-returned');

  // Optional stop timer without completing (simulate late check-in)
  const stopBtn = page.getByRole('button', { name: 'Stop work timer' });
  if ((await stopBtn.count()) > 0) {
    await stopBtn.first().click();
    await sleep(1200);
    wr.actions.push('Stopped timer later without marking completion.');
  }
}

async function generalWorkerPermissionAndMistakeAttempts(page, worker) {
  const wr = result.workers[worker.key];
  wr.actions = wr.actions || [];

  // Worker tries manager/owner pages
  const restrictedRoutes = ['/app/team', '/app/payroll', '/app/settings', '/app/herd', '/app/land', '/app/needs-attention', '/admin', '/checkout', '/app/work-orders/00000000-0000-0000-0000-000000000000'];
  wr.restrictedAttempts = [];
  for (const route of restrictedRoutes) {
    const access = await checkRouteAccess(page, worker.key, route);
    wr.restrictedAttempts.push(access);
  }

  // Worker tries to edit/reassign task through work-orders view
  await page.goto(`${baseUrl}/app/work-orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const body = clean(await page.locator('body').innerText());
  wr.reassignAttempt = {
    hasEditLink: (await page.getByRole('link', { name: 'Edit' }).count()) > 0,
    hasAssigneeCheckboxes: /Assign to/i.test(body),
    sample: body.slice(0, 300),
  };

  const detailHref = await page.locator('a[href^="/app/work-orders/"]').first().getAttribute('href').catch(() => null);
  const directRoute = detailHref || '/app/work-orders/00000000-0000-0000-0000-000000000000';
  wr.directWorkOrderDetailAttempt = await checkRouteAccess(page, worker.key, directRoute);

  wr.actions.push('Attempted to access manager/owner pages and to edit/reassign work as worker.');
  await screenshot(page, worker.key, 'general-permission-attempts');
}

async function badAtTechMobileFlow(worker) {
  const wr = result.workers[worker.key] = result.workers[worker.key] || { persona: worker.persona, username: worker.username };
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();

  try {
    // login
    let logged = false;
    for (const pass of candidatePasswords) {
      await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.getByLabel('Username').fill(worker.username);
      await page.getByLabel('Password').fill(pass);
      await page.getByRole('button', { name: 'Log in' }).click();
      await sleep(1800);
      if (page.url().includes('/reset-password')) {
        await page.locator('input[name="newPassword"]').fill(defaultResetPassword);
        await page.locator('input[name="confirmPassword"]').fill(defaultResetPassword);
        await page.getByRole('button', { name: 'Save new password' }).click();
        await sleep(1700);
        wr.passwordResetTriggered = true;
        wr.newPassword = defaultResetPassword;
      }
      if (page.url().includes('/app')) {
        logged = true;
        wr.loginWorked = true;
        wr.passwordUsed = pass;
        break;
      }
    }
    if (!logged) {
      wr.loginWorked = false;
      result.blockers.push(`Mobile login failed for ${worker.username}`);
      return;
    }

    await page.goto(`${baseUrl}/app/today`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1200);
    await screenshot(page, worker.key, 'mobile-today');
    const today = clean(await page.locator('body').innerText());

    // try to find highest priority task quickly
    const priorityMentions = (today.match(/Priority:\s*(low|normal|high)/gi) || []);
    const hasUrgentLabel = /urgent/i.test(today);

    await page.goto(`${baseUrl}/app/work-orders`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1200);
    await screenshot(page, worker.key, 'mobile-workorders');
    const wo = clean(await page.locator('body').innerText());

    const assignedCards = await getAssignedCards(page);
    const highCards = assignedCards.filter((txt) => /Priority:\s*high/i.test(txt));

    wr.mobileFlow = {
      todaySample: today.slice(0, 500),
      workOrdersSample: wo.slice(0, 500),
      priorityMentionsCount: priorityMentions.length,
      hasUrgentLabel,
      highPriorityCardsFound: highCards.length,
      assignedCardsCount: assignedCards.length,
    };

    wr.actions = wr.actions || [];
    wr.actions.push('On phone viewport, tried to identify highest-priority task from Today/Work Orders.');
  } finally {
    await browser.close();
  }
}

(async () => {
  // Desktop browser for all workers (fresh context per worker)
  const browser = await chromium.launch({ headless: true });
  try {
    for (const key of ['reed', 'lane', 'ty']) {
      const worker = workers.find((w) => w.key === key);
      if (!worker) continue;

      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      attachRuntimeLogging(page, worker.key);
      try {
        if (await loginAs(page, worker)) {
          await screenshot(page, worker.key, 'after-login');
          await collectVisibility(page, worker);
          await readTodayAndWorkQueue(page, worker);
          await inspectWorkerSettings(page, worker);
          await inspectHerdLandReadOnly(page, worker);
          if (worker.key === 'reed') {
            await reliableFlow(page, worker);
          } else if (worker.key === 'lane') {
            await forgetfulFlow(page, worker);
          }
          await generalWorkerPermissionAndMistakeAttempts(page, worker);
        }
      } finally {
        await page.close();
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  // Optional mobile flow helper retained for future runs.

  // Post-run synth notes
  for (const w of workers) {
    const wr = result.workers[w.key];
    if (!wr) continue;

    if (wr.workOrdersSummary && wr.workOrdersSummary.hasCreateForm) {
      result.permissionFindings.push(`${w.key}: worker unexpectedly sees create/manage work-order UI.`);
    }

    if (wr.reassignAttempt && wr.reassignAttempt.hasEditLink) {
      result.permissionFindings.push(`${w.key}: worker can see task Edit links.`);
    }

    if (wr.workOrdersSummary && /No assigned work yet/i.test(wr.workOrdersSummary.sample)) {
      result.ux.push(`${w.key}: empty assigned-work state shown.`);
    }

    const todaySample = wr.todaySummary?.sample || wr.mobileFlow?.todaySample || '';
    if (/Priority:\s*high/i.test(todaySample) === false && /Priority/i.test(todaySample)) {
      result.ux.push(`${w.key}: priority exists but urgent/highest-priority guidance is weak.`);
    }
  }

  // Save
  const summaryPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ok: true, outDir, summaryPath }, null, 2));
})();
