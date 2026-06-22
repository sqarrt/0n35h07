import { test, expect } from './fixtures'
import { en } from '../src/i18n/locales/en'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('menu-appearance').click()
})

test('appearance — all blocks on one screen', async ({ page }) => {
  await expect(page.getByRole('heading', { name: en.appearTitle })).toBeVisible()
  await expect(page.getByText(en.appearPrimaryColor)).toBeVisible()
  await expect(page.getByText(en.appearModel)).toBeVisible()
  await expect(page.getByText(en.appearShotAnim)).toBeVisible()
  await expect(page.getByText(en.appearRespawnAnim)).toBeVisible()
  await expect(page.getByText(en.appearDashTrail)).toBeVisible()
  await expect(page.getByText(en.appearShield, { exact: true })).toBeVisible()
  await expect(page.getByTestId('appearance-windup-classic')).toBeVisible()
  await expect(page.getByTestId('appearance-dash-streak')).toBeVisible()
  await expect(page.getByTestId('appearance-shield-dome')).toBeVisible()
})

test('appearance — 3D ball preview (canvas) and slot label', async ({ page }) => {
  await expect(page.locator('canvas').first()).toBeVisible()  // background menu canvas — ball preview
  await expect(page.getByText(en.appearSlotPrimary, { exact: true })).toBeVisible()   // active slot label
  // Clicking the reserve swatch switches the preview to the reserve slot
  await page.getByTestId('appearance-reserve-#fa4').click()
  await expect(page.getByText(en.appearSlotReserve, { exact: true })).toBeVisible()
})

test('appearance — sphere model switches and persists', async ({ page }) => {
  await page.getByTestId('appearance-model-waves').click()
  const model = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').ballModel)
  expect(model).toBe('waves')   // persisted to profile
})

test('appearance — shot animation switches and persists', async ({ page }) => {
  await page.getByTestId('appearance-windup-rage').click()
  const style = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').windupStyle)
  expect(style).toBe('rage')   // persisted to profile
})

test('appearance — respawn animation switches and persists', async ({ page }) => {
  await page.getByTestId('appearance-respawn-chaos').click()
  const style = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').respawnStyle)
  expect(style).toBe('chaos')   // persisted to profile
})

test('appearance — dash trail skin switches and persists', async ({ page }) => {
  await page.getByTestId('appearance-dash-wave').click()
  const style = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').dashStyle)
  expect(style).toBe('wave')   // persisted to profile
})

test('appearance — shield skin switches and persists', async ({ page }) => {
  await page.getByTestId('appearance-shield-hex').click()
  const style = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').shieldStyle)
  expect(style).toBe('hex')   // persisted to profile
})

test('appearance — ball art: clicking the field saves ballArt to profile', async ({ page }) => {
  await expect(page.getByText(en.appearPaint, { exact: true })).toBeVisible()
  const front = page.getByTestId('paint-front')
  await expect(front).toBeVisible()
  const box = (await front.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)   // center of the field — inside the disc
  const ballArt = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').ballArt)
  expect(typeof ballArt).toBe('string')
  expect(ballArt.length).toBe(88)   // 64 bytes base64
})

test('appearance — back → main menu', async ({ page }) => {
  await page.getByTestId('appearance-back').click()
  await expect(page.getByTestId('menu-play')).toBeVisible()
})
