import { expect, test } from "@playwright/test";

// Plays today's whole puzzle as a new guest at phone size, from Home to Results.
// Pin rounds use the keyboard option (focus the map, Enter drops the pin at the
// centre), so this also checks that path works.
test("a guest plays a full day at phone size", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Play", exact: true }).click();
  await expect(page).toHaveURL(/\/play$/);

  for (let round = 1; round <= 5; round++) {
    await expect(page.getByText(`${round}/5`, { exact: true })).toBeVisible();

    const choices = page.locator("fieldset button");
    if (await page.getByText("What used to be here?").isVisible()) {
      await expect(choices).toHaveCount(4);
      await choices.first().click();
    } else {
      await expect(page.getByText("Pin where it used to be.")).toBeVisible();
      const map = page.getByRole("region", { name: /Map of Saint John/ }).or(page.getByLabel(/Map of Saint John/)).first();
      await map.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("button", { name: "Lock it in" }).click();
    }

    // The reveal: points, an era card, and the way on.
    const next = page.getByRole("button", { name: round === 5 ? "See results" : "Next round" });
    await expect(next).toBeVisible();
    await expect(page.getByText(/points?/i).first()).toBeVisible();
    await next.click();
  }

  await expect(page.getByRole("heading", { name: "Today's score" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Rounds" }).getByRole("listitem")).toHaveCount(5);
  await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
  // Save image: the results card as a PNG (a download where the share sheet can't take files).
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save image" }).click();
  expect((await download).suggestedFilename()).toMatch(/^where-it-used-to-be-\d+\.png$/);
  await expect(page.getByRole("heading", { name: "Today's places" })).toBeVisible();

  // Home now offers the results instead of Play, and the page doesn't scroll sideways.
  await page.goto("/");
  await expect(page.getByRole("link", { name: "See today's results" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
