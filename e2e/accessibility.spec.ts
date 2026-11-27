import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { canSignIn, signInAs } from "./dev-sign-in";

// Automated WCAG 2.1 A/AA checks (axe) on every player-facing page.
// The map canvas itself is excluded: it's a picture of streets, and the game
// gives keyboard and screen-reader users the same information around it.
async function check(page: Page, what: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude(".maplibregl-canvas")
    .analyze();
  const summary = results.violations.map(
    (v) => `${what}: ${v.id} (${v.impact}) ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).slice(0, 5).join("\n  ")}`,
  );
  expect(summary, summary.join("\n")).toEqual([]);
}

for (const path of ["/dev/era-cards", "/", "/how-to-play", "/about", "/privacy", "/leaderboard", "/sign-in", "/groups", "/suggest"]) {
  test(`no accessibility problems on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await check(page, path);
  });
}

test("no accessibility problems while playing, on the reveal or on results", async ({ page }) => {
  await page.goto("/play");
  for (let round = 1; round <= 5; round++) {
    await expect(page.getByText(`${round}/5`, { exact: true })).toBeVisible();
    if (round === 1) await check(page, "round");
    if (await page.getByText("What used to be here?").isVisible()) {
      await page.locator("fieldset button").first().click();
    } else {
      await page.getByLabel(/Map of Saint John/).first().focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Lock it in" }).click();
    }
    const next = page.getByRole("button", { name: round === 5 ? "See results" : "Next round" });
    await expect(next).toBeVisible();
    if (round === 1) await check(page, "reveal");
    await next.click();
  }
  await expect(page.getByRole("heading", { name: "Today's score" })).toBeVisible();
  await check(page, "results");
});

// Signed-in pages, as the dev TEST: admin account (skipped against a preview).
test.describe("signed in", () => {
  test.skip(!canSignIn(), "needs the dev database in .env.local");
  const pages = [
    "/profile",
    "/groups",
    "/suggest",
    "/leaderboard",
    "/admin",
    "/admin/places",
    "/admin/puzzles",
    "/admin/import",
    "/admin/submissions",
  ];
  test("no accessibility problems on signed-in and admin pages", async ({ page }) => {
    await signInAs(page, "test-ana@wiutb.test");
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await check(page, path);
    }
  });
});
