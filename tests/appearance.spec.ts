import { test, expect } from './fixtures'
import { en } from '../src/i18n/locales/en'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('menu-appearance').click()
})

test('внешность — все блоки на одном экране', async ({ page }) => {
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

test('внешность — 3D-превью шара (canvas) и подпись слота', async ({ page }) => {
  await expect(page.locator('canvas')).toBeVisible()          // фоновый canvas меню — превью шара
  await expect(page.getByText(en.appearSlotPrimary, { exact: true })).toBeVisible()   // подпись активного слота
  // Клик по резервному свотчу переключает превью на резервный слот
  await page.getByTestId('appearance-reserve-#fa4').click()
  await expect(page.getByText(en.appearSlotReserve, { exact: true })).toBeVisible()
})

test('внешность — модель сферы переключается и сохраняется', async ({ page }) => {
  await page.getByTestId('appearance-model-waves').click()
  const model = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').ballModel)
  expect(model).toBe('waves')   // персист в профиль
})

test('внешность — анимация выстрела переключается и сохраняется', async ({ page }) => {
  await page.getByTestId('appearance-windup-rage').click()
  const style = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').windupStyle)
  expect(style).toBe('rage')   // персист в профиль
})

test('внешность — анимация респавна переключается и сохраняется', async ({ page }) => {
  await page.getByTestId('appearance-respawn-chaos').click()
  const style = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').respawnStyle)
  expect(style).toBe('chaos')   // персист в профиль
})

test('внешность — скин следа рывка переключается и сохраняется', async ({ page }) => {
  await page.getByTestId('appearance-dash-wave').click()
  const style = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').dashStyle)
  expect(style).toBe('wave')   // персист в профиль
})

test('внешность — скин щита переключается и сохраняется', async ({ page }) => {
  await page.getByTestId('appearance-shield-hex').click()
  const style = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').shieldStyle)
  expect(style).toBe('hex')   // персист в профиль
})

test('внешность — назад → главное меню', async ({ page }) => {
  await page.getByTestId('appearance-back').click()
  await expect(page.getByTestId('menu-play')).toBeVisible()
})
