import { test, expect } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('настройки — экран открывается и показывает палитру цветов', async ({ page }) => {
  await page.getByText('НАСТРОЙКИ').click()
  await expect(page.getByRole('heading', { name: 'НАСТРОЙКИ' })).toBeVisible()
  await expect(page.getByLabel('Имя игрока')).toBeVisible()
  await expect(page.getByText('ОСНОВНОЙ ЦВЕТ')).toBeVisible()
  await expect(page.getByText(/РЕЗЕРВНЫЙ ЦВЕТ/)).toBeVisible()
})

test('настройки — показывают 3D-превью шара (canvas) и подпись слота', async ({ page }) => {
  await page.getByText('НАСТРОЙКИ').click()
  await expect(page.locator('canvas')).toBeVisible()          // на экране настроек единственный canvas — превью
  await expect(page.getByText('ОСНОВНОЙ', { exact: true })).toBeVisible()   // подпись активного слота
  // Клик по резервному свотчу переключает превью на резервный слот
  await page.getByRole('button', { name: 'резервный #fa4' }).click()
  await expect(page.getByText('РЕЗЕРВНЫЙ', { exact: true })).toBeVisible()
})

test('настройки — вид по умолчанию (FP/TP) переключается и сохраняется', async ({ page }) => {
  await page.getByText('НАСТРОЙКИ').click()
  await expect(page.getByText('ВИД ПО УМОЛЧАНИЮ')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ОТ 1 ЛИЦА' })).toBeVisible()
  await page.getByRole('button', { name: 'ОТ 3 ЛИЦА' }).click()
  const view = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').defaultView)
  expect(view).toBe('tp')   // персист в профиль
})

test('настройки — имя сохраняется и видно в лобби как «(вы)»', async ({ page }) => {
  await page.getByText('НАСТРОЙКИ').click()
  const input = page.getByLabel('Имя игрока')
  await input.fill('ТестБоец')
  await page.getByText('НАЗАД').click()
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await expect(page.getByText('ТестБоец (вы)')).toBeVisible()
})
