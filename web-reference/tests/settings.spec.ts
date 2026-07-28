import { test, expect } from './fixtures'
import { en } from '../src/i18n/locales/en'
import { ru as ruDict } from '../src/i18n/locales/ru'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('settings — screen opens: name and default view', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await expect(page.getByRole('heading', { name: en.settingsTitle })).toBeVisible()
  await expect(page.getByTestId('settings-name-input')).toBeVisible()
  await expect(page.getByText(en.settingsDefaultView)).toBeVisible()
})

test('settings — default view (FP/TP) toggles and persists', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await expect(page.getByText(en.settingsDefaultView)).toBeVisible()
  await expect(page.getByTestId('settings-view-fp')).toBeVisible()
  await page.getByTestId('settings-view-tp').click()
  const view = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').defaultView)
  expect(view).toBe('tp')   // persisted to profile
})

test('settings — SOUND section: 4 sliders, change persists', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('settings-section-sound').click()
  await expect(page.getByRole('slider', { name: en.settingsVolMaster })).toBeVisible()
  await expect(page.getByRole('slider', { name: en.settingsVolMusic, exact: true })).toBeVisible()
  await expect(page.getByRole('slider', { name: en.settingsVolMenuMusic })).toBeVisible()
  await expect(page.getByRole('slider', { name: en.settingsVolSfx })).toBeVisible()
  await page.getByRole('slider', { name: en.settingsVolMusic, exact: true }).fill('50')   // ≠ default → onChange persists
  const vol = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').volumeMusic)
  expect(vol).toBeCloseTo(0.5, 5)   // persisted to profile (0..1)
  await page.getByRole('slider', { name: en.settingsVolMenuMusic }).fill('20')
  const volMenu = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').volumeMenuMusic)
  expect(volMenu).toBeCloseTo(0.2, 5)
})

test('settings — graphics: "MENU GLOW" checkbox disables the effect and persists', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('settings-section-graphics').click()
  const sw = page.getByTestId('settings-toggle-menu-glow')
  await expect(sw).toBeVisible()
  await sw.click()   // on → off
  const glow = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').menuGlow)
  expect(glow).toBe(false)   // persisted to profile
})

test('settings — name persists and is visible in the room', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  const input = page.getByTestId('settings-name-input')
  await input.fill('TestFighter')
  await page.getByTestId('settings-back').click()
  await page.getByTestId('menu-play').click()   // name visible in the player slot (// PLAYERS)
  await expect(page.getByText('TestFighter', { exact: true })).toBeVisible()
})

test('settings — default network role is BOTH', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('settings-section-net').click()
  await expect(page.getByTestId('settings-searchrole-both')).toHaveClass(/seg--on/)
})

test('settings — language choice applies immediately and persists to profile', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await expect(page.getByTestId('settings-language-label')).toHaveText(en.settingsLanguage)   // default en (fixture without locale)
  await page.getByTestId('settings-lang-ru').click()
  await expect(page.getByTestId('settings-language-label')).toHaveText(ruDict.settingsLanguage)  // applied immediately
  // Persist: setLocale → onChange → saveProfile → locale field in oneshot:profile
  const locale = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') ?? '{}').locale)
  expect(locale).toBe('ru')
})
