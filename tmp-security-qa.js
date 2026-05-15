const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const baseUrl = 'http://208.88.9.175:3002';
const outDir = path.join(process.cwd(), 'test-artifacts', `security-qa-${Date.now()}`);
fs.mkdirSync(outDir, { recursive: true });

const accounts = {
  owner: {
    display: 'Owner',
    username: 'tessa-morgan-qa-368958',
    candidatePasswords: ['Trailhead!2026', 'RanchPass123!', 'OwnerPass#2026!'],
    resetPassword: 'Trailhead!2026',
  },
  manager: {
    display: 'Manager',
    username: 'aubrey-mgr-155246',
    candidatePasswords: ['RanchMgr#2026!', 'RanchPass123!'],
    resetPassword: 'RanchMgr#2026!',
  },
  worker_reed: {
    display: 'Worker Reed',
    username: 'reed-reliable-155246',
    candidatePasswords: ['WorkerPass#2026!', 'RanchPass123!'],
    resetPassword: 'WorkerPass#2026!',
  },
  worker_lane: {
    display: 'Worker Lane',
    username: 'lane-forgetful-155246',
    candidatePasswords: ['WorkerPass#2026!', 'RanchPass123!'],
    resetPassword: 'WorkerPass#2026!',
  },
  worker_ty: {
    display: 'Worker Ty',
    username: 'ty-worker-298925',
    candidatePasswords: ['WorkerPass#2026!', 'RanchPass123!'],
    resetPassword: 'WorkerPass#2026!',
  },
};

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const result = {
  startedAt: new Date().toISOString(),
  outDir,
  knownRoutes: {},
  probes: {},
  ownerChecks: {},
  managerChecks: {},
  workerChecks: {},
  runtimeErrors: [],
  blockers: [],
};

function attachRuntime(page, roleKey) {
  page.on('pageerror', (error) => {
    result.runtimeErrors.push({
      roleKey,
      type: 'pageerror',
      message: String(error?.message || error),
      url: page.url(),
    });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      result.runtimeErrors.push({
        roleKey,
        type: 'console-error',
        message: msg.text(),
        url: page.url(),
      });
    }
  });
}

async function screenshot(page, roleKey, name) {
  const file = path.join(outDir, `${roleKey}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function login(page, roleKey, account) {
  const loginState = {
    username: account.username,
    loginWorked: false,
    passwordUsed: null,
    resetTriggered: false,
    finalUrl: null,
  };

  for (const pass of account.candidatePasswords) {
    await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.getByLabel('Username').fill(account.username);
    await page.getByLabel('Password').fill(pass);
    await page.getByRole('button', { name: 'Log in' }).click();
    await sleep(1600);

    if (page.url().includes('/reset-password')) {
      await page.locator('input[name="newPassword"]').fill(account.resetPassword);
      await page.locator('input[name="confirmPassword"]').fill(account.resetPassword);
      await page.getByRole('button', { name: 'Save new password' }).click();
      await sleep(1700);
      loginState.resetTriggered = true;
    }

    if (page.url().includes('/app')) {
      loginState.loginWorked = true;
      loginState.passwordUsed = pass;
      loginState.finalUrl = page.url();
      return loginState;
    }

    const body = clean(await page.locator('body').innerText().catch(() => ''));
    if (/Invalid username or password/i.test(body)) {
      continue;
    }
  }

  result.blockers.push(`Login failed for ${roleKey} (${account.username}).`);
  return loginState;
}

async function probeRoute(page, route) {
  let status = null;
  try {
    const response = await page.goto(`${baseUrl}${route}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    status = response ? response.status() : null;
  } catch (error) {
    return {
      route,
      finalUrl: page.url(),
      status,
      blocked: true,
      error: String(error?.message || error),
      sample: '',
    };
  }

  await sleep(900);
  const body = clean(await page.locator('body').innerText().catch(() => ''));
  const blocked =
    page.url().includes('/access-denied') ||
    /You do not have access|Access denied|Not authorized|owner-only|owner only/i.test(body);

  return {
    route,
    finalUrl: page.url(),
    status,
    blocked,
    hasSectionError: /Unable to load this app section/i.test(body),
    sample: body.slice(0, 260),
  };
}

function firstUuidHref(hrefs, prefix) {
  for (const href of hrefs) {
    if (!href || !href.startsWith(`${prefix}/`)) continue;
    const maybeId = href.slice(prefix.length + 1);
    if (/^[0-9a-f-]{36}$/i.test(maybeId)) return href;
  }
  return null;
}

async function discoverKnownRoutesAsOwner(page) {
  const known = {
    workOrderDetail: '/app/work-orders/00000000-0000-0000-0000-000000000000',
    herdDetail: '/app/herd/00000000-0000-0000-0000-000000000000',
    landDetail: '/app/land/00000000-0000-0000-0000-000000000000',
    teamMemberDetail: '/app/team/00000000-0000-0000-0000-000000000000',
    ownerMemberDetail: null,
  };

  await page.goto(`${baseUrl}/app/work-orders?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const workHrefs = await page.locator('a[href^="/app/work-orders/"]').evaluateAll((els) => els.map((el) => el.getAttribute('href'))).catch(() => []);
  const workDetail = firstUuidHref(workHrefs, '/app/work-orders');
  if (workDetail) known.workOrderDetail = workDetail;

  await page.goto(`${baseUrl}/app/herd`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const herdHrefs = await page.locator('a[href^="/app/herd/"]').evaluateAll((els) => els.map((el) => el.getAttribute('href'))).catch(() => []);
  const herdDetail = firstUuidHref(herdHrefs, '/app/herd');
  if (herdDetail) known.herdDetail = herdDetail;

  await page.goto(`${baseUrl}/app/land`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const landHrefs = await page.locator('a[href^="/app/land/"]').evaluateAll((els) => els.map((el) => el.getAttribute('href'))).catch(() => []);
  const landDetail = firstUuidHref(landHrefs, '/app/land');
  if (landDetail) known.landDetail = landDetail;

  await page.goto(`${baseUrl}/app/team?status=all`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1200);
  const teamHrefs = await page.locator('a[href^="/app/team/"]').evaluateAll((els) => els.map((el) => el.getAttribute('href'))).catch(() => []);
  const teamDetail = firstUuidHref(teamHrefs, '/app/team');
  if (teamDetail) known.teamMemberDetail = teamDetail;

  const ownerEditLink = page.getByRole('row').filter({ hasText: 'Tessa Morgan' }).locator('a[href^="/app/team/"]').first();
  const ownerHref = await ownerEditLink.getAttribute('href').catch(() => null);
  if (ownerHref && /^\/app\/team\/[0-9a-f-]{36}$/i.test(ownerHref)) {
    known.ownerMemberDetail = ownerHref;
    known.teamMemberDetail = ownerHref;
  } else {
    known.ownerMemberDetail = known.teamMemberDetail;
  }

  return known;
}

async function runOwnerChecks(page, known) {
  const owner = {};

  await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const settingsBody = clean(await page.locator('body').innerText());
  owner.settings = {
    hasAdminFailsafeButton: /Allow admin access|Block admin access/i.test(settingsBody),
    hasCheckoutAction: /Start Stripe checkout|Start \d+-day trial in Stripe/i.test(settingsBody),
    hasCustomerPortalAction: /Manage or cancel subscription|Customer Portal|Open Stripe Customer Portal/i.test(settingsBody),
    hasOwnerOnlyMessage: /Billing controls are owner-only/i.test(settingsBody),
  };

  await page.goto(`${baseUrl}/app/team`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const teamBody = clean(await page.locator('body').innerText());
  owner.team = {
    hasCreateMemberForm: /Create team member|Add team member|Temporary password/i.test(teamBody),
    hasEditLinks: (await page.getByRole('link', { name: 'Edit' }).count()) > 0,
  };

  if (known.ownerMemberDetail) {
    await page.goto(`${baseUrl}${known.ownerMemberDetail}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1100);

    const detailBodyBefore = clean(await page.locator('body').innerText());
    owner.selfProtection = {
      route: page.url(),
      hasDeactivateButton: (await page.getByRole('button', { name: 'Deactivate member' }).count()) > 0,
      hasDeleteButton: (await page.getByRole('button', { name: /Delete member permanently/i }).count()) > 0,
      hasSaveButton: (await page.getByRole('button', { name: 'Save changes' }).count()) > 0,
      preAttemptSample: detailBodyBefore.slice(0, 260),
    };

    if (owner.selfProtection.hasDeactivateButton) {
      await page.getByRole('button', { name: 'Deactivate member' }).first().click();
      await sleep(1400);
      const detailBodyAfter = clean(await page.locator('body').innerText());
      owner.selfProtection.deactivateAttemptMessage = /You cannot deactivate your own membership\./i.test(detailBodyAfter)
        ? 'blocked_with_expected_message'
        : detailBodyAfter.slice(0, 300);
    }

    if (owner.selfProtection.hasDeleteButton) {
      let confirmText = null;
      page.once('dialog', async (dialog) => {
        confirmText = dialog.message();
        await dialog.dismiss();
      });
      await page.getByRole('button', { name: /Delete member permanently/i }).first().click();
      await sleep(800);
      owner.selfProtection.deleteAttempt = {
        confirmationPromptShown: Boolean(confirmText),
        confirmationText: confirmText,
      };
    }
  }

  owner.screenshots = {
    settings: await screenshot(page, 'owner', 'post-owner-checks'),
  };

  return owner;
}

async function runManagerChecks(page, known) {
  const mgr = {};

  await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(1000);
  const settingsBody = clean(await page.locator('body').innerText());
  mgr.settings = {
    hasAdminFailsafeButton: /Allow admin access|Block admin access/i.test(settingsBody),
    hasCheckoutAction: /Start Stripe checkout|Start \d+-day trial in Stripe/i.test(settingsBody),
    hasCustomerPortalAction: /Manage or cancel subscription|Customer Portal|Open Stripe Customer Portal/i.test(settingsBody),
    hasOwnerOnlyText: /Only ranch owners can change this setting|Billing controls are owner-only/i.test(settingsBody),
  };

  const ownerRoute = known.ownerMemberDetail || known.teamMemberDetail;
  if (ownerRoute) {
    await page.goto(`${baseUrl}${ownerRoute}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(1100);
    const body = clean(await page.locator('body').innerText());
    mgr.ownerMembershipDetail = {
      route: page.url(),
      hasSaveButton: (await page.getByRole('button', { name: 'Save changes' }).count()) > 0,
      hasDeactivateButton: (await page.getByRole('button', { name: /Deactivate member|Activate member/i }).count()) > 0,
      hasDeleteButton: (await page.getByRole('button', { name: /Delete member permanently/i }).count()) > 0,
      hasResetPasswordButton: (await page.getByRole('button', { name: /Reset password/i }).count()) > 0,
      hasOwnerOnlyWarning: /Only ranch owners can edit this member profile|Managers cannot reset owner passwords/i.test(body),
      sample: body.slice(0, 320),
    };
  }

  mgr.screenshot = await screenshot(page, 'manager', 'post-manager-checks');
  return mgr;
}

async function runWorkerChecks(page, roleKey) {
  const wk = {};

  await page.goto(`${baseUrl}/app/settings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(900);
  const settingsBody = clean(await page.locator('body').innerText());
  wk.settings = {
    hasActionableBillingControls: /Start Stripe checkout|Customer Portal|Open Stripe Customer Portal|Allow admin access|Block admin access/i.test(settingsBody),
    hasBillingWording: /billing|subscription|lifetime|access/i.test(settingsBody),
    hasOwnerOnlyWording: /Billing controls are owner-only|Admin and billing settings are managed by ranch owners/i.test(settingsBody),
  };

  await page.goto(`${baseUrl}/app/herd`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(900);
  const herdBody = clean(await page.locator('body').innerText());
  wk.herdList = {
    route: page.url(),
    hasReadOnlyWording: /Owners and managers can add animals|Your role is worker|Owners and managers can create herd groups/i.test(herdBody),
    hasCreateSubmitButton: (await page.getByRole('button', { name: /Add animal|Save animal|Create herd group/i }).count()) > 0,
  };

  await page.goto(`${baseUrl}/app/land`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await sleep(900);
  const landBody = clean(await page.locator('body').innerText());
  wk.landList = {
    route: page.url(),
    hasReadOnlyWording: /Owners and managers can create land units|Your role is worker/i.test(landBody),
    hasCreateSubmitButton: (await page.getByRole('button', { name: /Create land unit|Save land unit/i }).count()) > 0,
  };

  wk.screenshot = await screenshot(page, roleKey, 'post-worker-checks');
  return wk;
}

async function runRouteProbesForRole(page, roleKey, known) {
  const routes = [
    '/admin',
    '/checkout',
    '/app/team',
    '/app/payroll',
    '/app/needs-attention',
    '/app/settings',
    '/app/herd',
    '/app/land',
    '/app/work-orders',
    known.workOrderDetail,
    known.herdDetail,
    known.landDetail,
    known.teamMemberDetail,
  ];

  const uniqueRoutes = Array.from(new Set(routes.filter(Boolean)));
  const out = [];
  for (const route of uniqueRoutes) {
    out.push(await probeRoute(page, route));
  }
  return out;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    // Owner first: discover known routes from canonical role.
    {
      const roleKey = 'owner';
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      attachRuntime(page, roleKey);
      try {
        const loginState = await login(page, roleKey, accounts.owner);
        result.probes[roleKey] = { login: loginState };

        if (loginState.loginWorked) {
          const known = await discoverKnownRoutesAsOwner(page);
          result.knownRoutes = known;
          result.ownerChecks = await runOwnerChecks(page, known);
          result.probes[roleKey].routes = await runRouteProbesForRole(page, roleKey, known);
        }
      } finally {
        await context.close();
      }
    }

    // Manager
    {
      const roleKey = 'manager';
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      attachRuntime(page, roleKey);
      try {
        const loginState = await login(page, roleKey, accounts.manager);
        result.probes[roleKey] = { login: loginState };
        if (loginState.loginWorked) {
          result.managerChecks = await runManagerChecks(page, result.knownRoutes);
          result.probes[roleKey].routes = await runRouteProbesForRole(page, roleKey, result.knownRoutes);
        }
      } finally {
        await context.close();
      }
    }

    // Workers
    for (const roleKey of ['worker_reed', 'worker_lane', 'worker_ty']) {
      const context = await browser.newContext({ ignoreHTTPSErrors: true });
      const page = await context.newPage();
      attachRuntime(page, roleKey);
      try {
        const loginState = await login(page, roleKey, accounts[roleKey]);
        result.probes[roleKey] = { login: loginState };
        if (loginState.loginWorked) {
          result.workerChecks[roleKey] = await runWorkerChecks(page, roleKey);
          result.probes[roleKey].routes = await runRouteProbesForRole(page, roleKey, result.knownRoutes);
        }
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  result.finishedAt = new Date().toISOString();
  const summaryPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ok: true, outDir, summaryPath }, null, 2));
})();
