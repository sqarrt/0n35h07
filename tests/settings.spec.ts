import { test, expect } from './fixtures'
import { en } from '../src/i18n/locales/en'
import { ru as ruDict } from '../src/i18n/locales/ru'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('настройки — экран открывается: имя и вид по умолчанию', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await expect(page.getByRole('heading', { name: en.settingsTitle })).toBeVisible()
  await expect(page.getByTestId('settings-name-input')).toBeVisible()
  await expect(page.getByText(en.settingsDefaultView)).toBeVisible()
})

test('настройки — вид по умолчанию (FP/TP) переключается и сохраняется', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await expect(page.getByText(en.settingsDefaultView)).toBeVisible()
  await expect(page.getByTestId('settings-view-fp')).toBeVisible()
  await page.getByTestId('settings-view-tp').click()
  const view = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').defaultView)
  expect(view).toBe('tp')   // персист в профиль
})

test('настройки — раздел ЗВУК: 4 ползунка, изменение сохраняется', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('settings-section-sound').click()
  await expect(page.getByRole('slider', { name: en.settingsVolMaster })).toBeVisible()
  await expect(page.getByRole('slider', { name: en.settingsVolMusic, exact: true })).toBeVisible()
  await expect(page.getByRole('slider', { name: en.settingsVolMenuMusic })).toBeVisible()
  await expect(page.getByRole('slider', { name: en.settingsVolSfx })).toBeVisible()
  await page.getByRole('slider', { name: en.settingsVolMusic, exact: true }).fill('50')   // ≠ дефолта → onChange сохранит
  const vol = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').volumeMusic)
  expect(vol).toBeCloseTo(0.5, 5)   // персист в профиль (0..1)
  await page.getByRole('slider', { name: en.settingsVolMenuMusic }).fill('20')
  const volMenu = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').volumeMenuMusic)
  expect(volMenu).toBeCloseTo(0.2, 5)
})

test('настройки — графика: галка «СВЕЧЕНИЕ В МЕНЮ» отключает эффект и сохраняется', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await page.getByTestId('settings-section-graphics').click()
  const sw = page.getByTestId('settings-toggle-menu-glow')
  await expect(sw).toBeVisible()
  await sw.click()   // вкл → выкл
  const glow = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').menuGlow)
  expect(glow).toBe(false)   // персист в профиль
})

test('настройки — имя сохраняется и видно в комнате', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  const input = page.getByTestId('settings-name-input')
  await input.fill('ТестБоец')
  await page.getByTestId('settings-back').click()
  await page.getByTestId('menu-play').click()   // имя видно в слоте игрока (// ИГРОКИ)
  await expect(page.getByText('ТестБоец', { exact: true })).toBeVisible()
})

test('настройки — выбор языка применяется сразу и сохраняется в профиль', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await expect(page.getByTestId('settings-language-label')).toHaveText(en.settingsLanguage)   // дефолт en (фикстура без locale)
  await page.getByTestId('settings-lang-ru').click()
  await expect(page.getByTestId('settings-language-label')).toHaveText(ruDict.settingsLanguage)  // применился сразу
  // Персист: setLocale → onChange → saveProfile → поле locale в oneshot:profile
  const locale = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') ?? '{}').locale)
  expect(locale).toBe('ru')
})
