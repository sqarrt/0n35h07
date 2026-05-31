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

test('настройки — имя сохраняется и видно в лобби как «(вы)»', async ({ page }) => {
  await page.getByText('НАСТРОЙКИ').click()
  const input = page.getByLabel('Имя игрока')
  await input.fill('ТестБоец')
  await page.getByText('НАЗАД').click()
  await page.getByText('СОЗДАТЬ ЛОББИ').click()
  await expect(page.getByText('ТестБоец (вы)')).toBeVisible()
})
