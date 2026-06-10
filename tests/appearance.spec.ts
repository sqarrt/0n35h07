import { test, expect } from './fixtures'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('внешность — экран открывается: подвкладки и палитра цветов', async ({ page }) => {
  await page.getByText('ВНЕШНОСТЬ').click()
  await expect(page.getByRole('heading', { name: 'ВНЕШНОСТЬ' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'ЦВЕТ' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'МОДЕЛЬ', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'ВЫСТРЕЛ' })).toBeVisible()
  await expect(page.getByText('ОСНОВНОЙ ЦВЕТ')).toBeVisible()
  await expect(page.getByText(/РЕЗЕРВНЫЙ ЦВЕТ/)).toBeVisible()
})

test('внешность — 3D-превью шара (canvas) и подпись слота', async ({ page }) => {
  await page.getByText('ВНЕШНОСТЬ').click()
  await expect(page.locator('canvas')).toBeVisible()          // фоновый canvas меню — превью шара
  await expect(page.getByText('ОСНОВНОЙ', { exact: true })).toBeVisible()   // подпись активного слота
  // Клик по резервному свотчу переключает превью на резервный слот
  await page.getByRole('button', { name: 'резервный #fa4' }).click()
  await expect(page.getByText('РЕЗЕРВНЫЙ', { exact: true })).toBeVisible()
})

test('внешность — модель сферы переключается и сохраняется', async ({ page }) => {
  await page.getByText('ВНЕШНОСТЬ').click()
  await page.getByRole('button', { name: 'МОДЕЛЬ', exact: true }).click()
  await expect(page.getByText('МОДЕЛЬ СФЕРЫ')).toBeVisible()
  await page.getByRole('button', { name: 'ВОЛНЫ' }).click()
  const model = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').ballModel)
  expect(model).toBe('waves')   // персист в профиль
})

test('внешность — анимация выстрела переключается и сохраняется', async ({ page }) => {
  await page.getByText('ВНЕШНОСТЬ').click()
  await page.getByRole('button', { name: 'ВЫСТРЕЛ' }).click()
  await expect(page.getByText('АНИМАЦИЯ ВЫСТРЕЛА')).toBeVisible()
  await page.getByRole('button', { name: 'ЯРОСТЬ' }).click()
  const style = await page.evaluate(() => JSON.parse(localStorage.getItem('oneshot:profile') || '{}').windupStyle)
  expect(style).toBe('rage')   // персист в профиль
})

test('внешность — назад → главное меню', async ({ page }) => {
  await page.getByText('ВНЕШНОСТЬ').click()
  await page.getByText('НАЗАД').click()
  await expect(page.getByText('СОЗДАТЬ ЛОББИ')).toBeVisible()
})
