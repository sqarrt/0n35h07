import { test, expect } from './fixtures'
import { ru as ruDict } from '../src/i18n/locales/ru'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('настройки — экран открывается: имя и вид по умолчанию', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await expect(page.getByRole('heading', { name: 'НАСТРОЙКИ' })).toBeVisible()
  await expect(page.getByLabel('Имя игрока')).toBeVisible()
  await expect(page.getByText('ВИД ПО УМОЛЧАНИЮ')).toBeVisible()
})

test('настройки — вид по умолчанию (FP/TP) переключается и сохраняется', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await expect(page.getByText('ВИД ПО УМОЛЧАНИЮ')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ОТ 1 ЛИЦА' })).toBeVisible()
  await page.getByRole('button', { name: 'ОТ 3 ЛИЦА' }).click()
  const view = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').defaultView)
  expect(view).toBe('tp')   // персист в профиль
})

test('настройки — раздел ЗВУК: 4 ползунка, изменение сохраняется', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await page.getByRole('button', { name: 'ЗВУК' }).click()
  await expect(page.getByRole('slider', { name: 'ОБЩАЯ ГРОМКОСТЬ' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'МУЗЫКА', exact: true })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'МУЗЫКА В МЕНЮ' })).toBeVisible()
  await expect(page.getByRole('slider', { name: 'ЭФФЕКТЫ' })).toBeVisible()
  await page.getByRole('slider', { name: 'МУЗЫКА', exact: true }).fill('50')   // ≠ дефолта → onChange сохранит
  const vol = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').volumeMusic)
  expect(vol).toBeCloseTo(0.5, 5)   // персист в профиль (0..1)
  await page.getByRole('slider', { name: 'МУЗЫКА В МЕНЮ' }).fill('20')
  const volMenu = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').volumeMenuMusic)
  expect(volMenu).toBeCloseTo(0.2, 5)
})

test('настройки — графика: галка «СВЕЧЕНИЕ В МЕНЮ» отключает эффект и сохраняется', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  await page.getByRole('button', { name: 'ГРАФИКА' }).click()
  const sw = page.getByRole('switch', { name: 'Свечение в меню' })
  await expect(sw).toBeVisible()
  await sw.click()   // вкл → выкл
  const glow = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').menuGlow)
  expect(glow).toBe(false)   // персист в профиль
})

test('настройки — имя сохраняется и видно в комнате', async ({ page }) => {
  await page.getByTestId('menu-settings').click()
  const input = page.getByLabel('Имя игрока')
  await input.fill('ТестБоец')
  await page.getByText('НАЗАД').click()
  await page.getByTestId('menu-create-room').click()
  await expect(page.getByText('ТестБоец', { exact: true })).toBeVisible()
})

test('настройки — выбор языка применяется сразу и переживает перезагрузку', async ({ page }) => {
  // Context-level initScript (fixtures) перезаписывает oneshot:profile при каждой навигации.
  // Чтобы персистентность locale проверялась честно, патчим профиль с locale:'en' через
  // page-level addInitScript, который выполняется ПОСЛЕ context-level initScript:
  // он читает профиль (уже перезаписанный fixtures) и добавляет locale из отдельного ключа
  // oneshot:test-locale, который fixtures не трогает. После смены языка мы пишем в этот ключ.
  await page.addInitScript(() => {
    try {
      const savedLocale = localStorage.getItem('oneshot:test-locale') ?? 'en'
      const raw = localStorage.getItem('oneshot:profile')
      const profile = raw ? JSON.parse(raw) : {}
      localStorage.setItem('oneshot:profile', JSON.stringify({ ...profile, locale: savedLocale }))
    } catch { /* ignore */ }
  })
  await page.reload()
  await page.getByTestId('menu-settings').click()
  await expect(page.getByTestId('settings-language-label')).toHaveText('LANGUAGE')
  await page.getByTestId('settings-lang-ru').click()
  await expect(page.getByTestId('settings-language-label')).toHaveText(ruDict.settingsLanguage)
  // Сохраняем выбранный locale в отдельный ключ (переживает перезапись fixtures при reload).
  await page.evaluate(() => {
    const profile = JSON.parse(localStorage.getItem('oneshot:profile') ?? '{}')
    if (profile.locale) localStorage.setItem('oneshot:test-locale', profile.locale)
  })
  await page.reload()
  await page.getByTestId('menu-settings').click()
  await expect(page.getByTestId('settings-language-label')).toHaveText(ruDict.settingsLanguage)
})
