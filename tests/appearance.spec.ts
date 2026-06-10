import { test, expect } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByText('ВНЕШНОСТЬ').click()
})

test('внешность — все блоки на одном экране', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'ВНЕШНОСТЬ' })).toBeVisible()
  await expect(page.getByText('ОСНОВНОЙ ЦВЕТ')).toBeVisible()
  await expect(page.getByText('МОДЕЛЬ СФЕРЫ')).toBeVisible()
  await expect(page.getByText('АНИМАЦИЯ ВЫСТРЕЛА')).toBeVisible()
  await expect(page.getByText('АНИМАЦИЯ РЕСПАВНА')).toBeVisible()
  await expect(page.getByRole('button', { name: 'ИМПУЛЬС' })).toBeVisible()
})

test('внешность — 3D-превью шара (canvas) и подпись слота', async ({ page }) => {
  await expect(page.locator('canvas')).toBeVisible()          // фоновый canvas меню — превью шара
  await expect(page.getByText('ОСНОВНОЙ', { exact: true })).toBeVisible()   // подпись активного слота
  // Клик по резервному свотчу переключает превью на резервный слот
  await page.getByRole('button', { name: 'резервный #fa4' }).click()
  await expect(page.getByText('РЕЗЕРВНЫЙ', { exact: true })).toBeVisible()
})

test('внешность — модель сферы переключается и сохраняется', async ({ page }) => {
  await page.getByRole('button', { name: 'ВОЛНЫ' }).click()
  const model = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').ballModel)
  expect(model).toBe('waves')   // персист в профиль
})

test('внешность — анимация выстрела переключается и сохраняется', async ({ page }) => {
  await page.getByRole('button', { name: 'ЯРОСТЬ' }).click()
  const style = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').windupStyle)
  expect(style).toBe('rage')   // персист в профиль
})

test('внешность — анимация респавна переключается и сохраняется', async ({ page }) => {
  await page.getByRole('button', { name: 'ХАОС' }).click()
  const style = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').respawnStyle)
  expect(style).toBe('chaos')   // персист в профиль
})

test('внешность — назад → главное меню', async ({ page }) => {
  await page.getByText('НАЗАД').click()
  await expect(page.getByText('СОЗДАТЬ ЛОББИ')).toBeVisible()
})
