import { test, expect, Page } from "@playwright/test";
async function login(page: Page, email: string, password: string) {
  await page.goto("/en/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password (12–72 characters)").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
}
async function create(
  page: Page,
  module: string,
  values: Record<string, string>,
  selects: Record<string, string> = {},
) {
  await page
    .locator(".sidebar")
    .getByRole("button", { name: module, exact: false })
    .click();
  await page.getByRole("button", { name: "+ Create", exact: true }).click();
  const dialog = page.getByRole("dialog");
  for (const [name, value] of Object.entries(values))
    await dialog.getByLabel(name, { exact: true }).fill(value);
  for (const [name, value] of Object.entries(selects))
    await dialog
      .getByLabel(name, { exact: false })
      .selectOption({ label: value });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).not.toBeVisible();
}
test("brand, languages and responsive navigation", async ({ page }) => {
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Technology that",
  );
  await expect(page.locator(".service-card")).toHaveCount(4);
  await page.screenshot({ path: "/tmp/ab-desktop.png", fullPage: true });
  await page.getByRole("link", { name: "ES", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Tecnología que",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("link", { name: "Servicios", exact: true }).click();
  await expect(page.locator("#services")).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.screenshot({ path: "/tmp/ab-mobile.png", fullPage: true });
});
test("customer request, staff workflow and accounting", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const unique = Date.now(),
    email = `client-${unique}@example.test`,
    password = "test-only-password-123";
  await page.goto("/en/login");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await page.getByLabel("Full name").fill(`Test Client ${unique}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password (12–72 characters)").fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: false })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("Account created");
  await login(page, email, password);
  await create(
    page,
    "My tickets",
    { Title: `Repair ${unique}`, Description: "The computer does not start." },
    { Category: "Hardware & software repair", Priority: "High" },
  );
  await page
    .getByRole("button", { name: `Repair ${unique}`, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .locator("input[type=file]")
    .setInputFiles({
      name: "diagnostic.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Diagnostic report"),
    });
  await page.getByRole("button", { name: "Upload file", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "diagnostic.txt" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page
      .locator(".sidebar")
      .getByRole("button", { name: "Accounting", exact: false }),
  ).toHaveCount(0);
  const adminContext = await browser.newContext(),
    adminPage = await adminContext.newPage();
  await login(
    adminPage,
    process.env.TEST_ADMIN_EMAIL || "admin@ab.test",
    process.env.TEST_ADMIN_PASSWORD || "test-only-admin-password-123",
  );
  await adminPage
    .locator(".sidebar")
    .getByRole("button", { name: "Helpdesk" })
    .click();
  await adminPage
    .getByRole("button", { name: `Repair ${unique}`, exact: true })
    .click();
  await adminPage
    .getByRole("dialog")
    .getByLabel("How can we help?")
    .fill("We have reviewed your diagnostic report.");
  await adminPage
    .getByRole("button", { name: "Send reply", exact: true })
    .click();
  await expect(adminPage.locator(".conversation")).toContainText(
    "reviewed your diagnostic",
  );
  await adminPage.getByRole("button", { name: "Close", exact: true }).click();
  await create(
    adminPage,
    "Projects",
    { Title: `Project ${unique}`, "Due date": "2027-01-01" },
    { Customer: `Test Client ${unique}`, "Assigned to": "Administrator" },
  );
  await create(
    adminPage,
    "Tasks",
    { Title: `Task ${unique}`, "Due date": "2027-01-01" },
    { Project: `Project ${unique}`, "Assigned to": "Administrator" },
  );
  await adminPage
    .locator(".work-card")
    .filter({ hasText: `Task ${unique}` })
    .getByLabel("Status")
    .selectOption("completed");
  await expect(adminPage.locator(".kanban-column").last()).toContainText(
    `Task ${unique}`,
  );
  await create(
    adminPage,
    "Invoices",
    { Title: `Invoice ${unique}`, Amount: "125.00", "Due date": "2027-01-01" },
    {
      Customer: `Test Client ${unique}`,
      Service: "Hardware & software repair",
      Currency: "USD",
    },
  );
  await adminPage
    .getByRole("button", { name: `Invoice ${unique}`, exact: true })
    .click();
  await adminPage
    .getByLabel("Bank / provider reference")
    .fill(`test-bank-${unique}`);
  await adminPage
    .getByRole("button", { name: "Record verified payment", exact: true })
    .click();
  await expect(adminPage.getByRole("dialog")).toContainText("Paid");
  await adminPage.getByRole("button", { name: "Close", exact: true }).click();
  await adminPage
    .locator(".sidebar")
    .getByRole("button", { name: "Accounting" })
    .click();
  await expect(adminPage.locator(".workspace-main")).toContainText(
    `Invoice ${unique}`,
  );
  await adminPage.evaluate(() =>
    window.scrollTo({ top: 0, behavior: "instant" }),
  );
  await adminPage.screenshot({ path: "/tmp/ab-workspace.png", fullPage: true });
  await page.reload();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Invoices" })
    .click();
  await expect(page.locator(".workspace-main")).toContainText(
    `Invoice ${unique}`,
  );
  await expect(page.locator(".workspace-main")).toContainText("Paid");
  await adminContext.close();
});

test("contact CRM, employee permissions and attendance", async ({
  page,
  browser,
}) => {
  test.setTimeout(90000);
  const unique = Date.now();
  await page.goto("/en");
  const contact = page.locator("#contact");
  await contact.getByLabel("Full name").fill(`Lead ${unique}`);
  await contact
    .getByLabel("Email", { exact: true })
    .fill(`lead-${unique}@example.test`);
  await contact
    .getByLabel("How can we help?")
    .fill("We need a custom application.");
  await contact.getByRole("button", { name: "Send request" }).click();
  await expect(contact.getByRole("status")).toContainText("received");
  await login(
    page,
    process.env.TEST_ADMIN_EMAIL || "admin@ab.test",
    process.env.TEST_ADMIN_PASSWORD || "test-only-admin-password-123",
  );
  await page.locator(".sidebar").getByRole("button", { name: "CRM" }).click();
  await expect(page.locator(".workspace-main")).toContainText(`Lead ${unique}`);
  await page
    .locator(".work-card")
    .filter({ hasText: `Lead ${unique}` })
    .getByLabel("Status")
    .selectOption("proposal");
  const employee = `staff-${unique}@example.test`,
    password = "test-only-employee-password";
  await create(
    page,
    "Employees",
    {
      "Full name": `Staff ${unique}`,
      Email: employee,
      "Password (12–72 characters)": password,
    },
    { Role: "Employee" },
  );
  const card = page.locator(".work-card").filter({ hasText: employee });
  await card.getByLabel("Department").fill("Support");
  await card.getByLabel("CRM access").check();
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Saved");
  const context = await browser.newContext(),
    staffPage = await context.newPage();
  await login(staffPage, employee, password);
  await expect(
    staffPage.locator(".sidebar").getByRole("button", { name: "CRM" }),
  ).toBeVisible();
  await expect(
    staffPage.locator(".sidebar").getByRole("button", { name: "Accounting" }),
  ).toHaveCount(0);
  await staffPage
    .locator(".sidebar")
    .getByRole("button", { name: "Time & attendance" })
    .click();
  await staffPage.getByRole("button", { name: "+ Clock in" }).click();
  await staffPage
    .getByRole("dialog")
    .getByLabel("Title", { exact: true })
    .fill(`Shift ${unique}`);
  await staffPage
    .getByRole("dialog")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(staffPage.getByRole("dialog")).not.toBeVisible();
  await staffPage
    .getByRole("button", { name: "Clock out", exact: true })
    .click();
  await expect(staffPage.locator(".work-card")).toContainText("Completed");
  await staffPage.getByRole("link", { name: "ES", exact: true }).click();
  await expect(
    staffPage.getByRole("heading", { name: "Resumen", exact: true }),
  ).toBeVisible();
  await staffPage.setViewportSize({ width: 390, height: 844 });
  expect(
    await staffPage.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
