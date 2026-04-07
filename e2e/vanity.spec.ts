import { test, expect } from '@playwright/test'

test.describe('Vanity Address Generation', () => {
  test('page loads with generator UI', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('text=Address Generator')).toBeVisible()
    await expect(page.locator('[data-testid="prefix-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="suffix-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="start-button"]')).toBeVisible()
  })

  test('prefix input only accepts hex characters', async ({ page }) => {
    await page.goto('/')
    const input = page.locator('[data-testid="prefix-input"]')
    await input.fill('xyz!@#deadBEEF')
    // Non-hex chars stripped by onChange handler
    await expect(input).toHaveValue('deadBEEF')
  })

  test('generates address with short prefix', async ({ page }) => {
    await page.goto('/')

    await page.locator('[data-testid="prefix-input"]').fill('aa')
    await page.locator('[data-testid="start-button"]').click()

    // Wait for at least one result (short prefix = fast)
    await expect(page.locator('[data-testid="result-address"]').first()).toBeVisible({ timeout: 60000 })

    const address = await page.locator('[data-testid="result-address"]').first().textContent()
    expect(address?.toLowerCase()).toMatch(/^0xaa/i)
  })

  test('stops generation on button click', async ({ page }) => {
    await page.goto('/')

    await page.locator('[data-testid="prefix-input"]').fill('aaa')
    await page.locator('[data-testid="start-button"]').click()

    // Wait briefly then stop
    await page.waitForTimeout(2000)
    await page.locator('[data-testid="stop-button"]').click()

    // Start button should reappear
    await expect(page.locator('[data-testid="start-button"]')).toBeVisible()
  })

  test('shows stats during generation', async ({ page }) => {
    await page.goto('/')

    await page.locator('[data-testid="prefix-input"]').fill('aa')
    await page.locator('[data-testid="start-button"]').click()

    // Stats grid should appear
    await expect(page.locator('text=Speed')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Attempts')).toBeVisible()
    await expect(page.locator('text=Elapsed')).toBeVisible()

    // Stop to clean up
    await page.locator('[data-testid="stop-button"]').click()
  })

  test('shows difficulty estimate when pattern entered', async ({ page }) => {
    await page.goto('/')
    await page.locator('[data-testid="prefix-input"]').fill('dead')
    await expect(page.locator('text=Estimated Time')).toBeVisible()
  })
})

test.describe('Navigation', () => {
  test('navigates between Vanity and CloakSeed tabs', async ({ page }) => {
    await page.goto('/')

    // Should start on Vanity page
    await expect(page.locator('text=Vanity Address Generator')).toBeVisible()

    // Navigate to CloakSeed
    await page.click('text=CloakSeed')
    await expect(page.locator('text=CloakSeed').first()).toBeVisible()

    // Navigate back
    await page.click('text=Vanity Generator')
    await expect(page.locator('text=Vanity Address Generator')).toBeVisible()
  })
})
