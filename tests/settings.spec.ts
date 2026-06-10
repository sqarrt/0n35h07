import { test, expect } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('настройки — экран открывается: имя и вид по умолчанию', async ({ page }) => {
  await page.getByText('НАСТРОЙКИ').click()
  await expect(page.getByRole('heading', { name: 'НАСТРОЙКИ' })).toBeVisible()
  await expect(page.getByLabel('Имя игрока')).toBeVisible()
  await expect(page.getByText('ВИД ПО УМОЛЧАНИЮ')).toBeVisible()
})

test('настройки — вид по умолчанию (FP/TP) переключается и сохраняется', async ({ page }) => {
  await page.getByText('НАСТРОЙКИ').click()
  await expect(page.getByText('ВИД ПО УМОЛЧАНИЮ')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ОТ 1 ЛИЦА' })).toBeVisible()
  await page.getByRole('button', { name: 'ОТ 3 ЛИЦА' }).click()
  const view = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').defaultView)
  expect(view).toBe('tp')   // персист в профиль
})

test('настройки — раздел ЗВУК: 4 ползунка, изменение сохраняется', async ({ page }) => {
  await page.getByText('НАСТРОЙКИ').click()
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
  await page.getByText('НАСТРОЙКИ').click()
  await page.getByRole('button', { name: 'ГРАФИКА' }).click()
  const sw = page.getByRole('switch', { name: 'Свечение в меню' })
  await expect(sw).toBeVisible()
  await sw.click()   // вкл → выкл
  const glow = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').menuGlow)
  expect(glow).toBe(false)   // персист в профиль
})

test('настройки — имя сохраняется и видно в лобби', async ({ page }) => {
  await page.getByText('НАСТРОЙКИ').click()
  const input = page.getByLabel('Имя игрока')
  await input.fill('ТестБоец')
  await page.getByText('НАЗАД').click()
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await expect(page.getByText('ТестБоец', { exact: true })).toBeVisible()
})
