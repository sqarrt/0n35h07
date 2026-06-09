import { app, BrowserWindow, Menu } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Десктоп: разрешаем звук без пользовательского жеста (музыка/SFX стартуют сразу при запуске).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

// В упакованном (prod) билде DevTools должен быть недоступен: ниже отключаем его в webPreferences (закрывает
// F12/Ctrl+Shift+I и программный вызов), а здесь убираем дефолтное меню — в нём живёт акселератор «Toggle
// Developer Tools». В dev меню оставляем (удобно отлаживать).
if (app.isPackaged) Menu.setApplicationMenu(null)

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,            // размер окна в оконном режиме (если выйти из fullscreen)
    fullscreen: true,       // сразу на весь экран
    backgroundColor: '#06080c',   // тёмный фон окна: иначе дефолтный серый просвечивает сквозь прозрачный canvas меню
    title: 'ONESHOT',
    icon: path.join(__dirname, '../build/icon.png'),   // иконка окна (dev); упакованную ставит electron-builder
    webPreferences: {
      // preload не нужен (Node API рендереру не требуется): пустой preload tsc делает ESM-модулем,
      // а sandbox грузит его как CommonJS → ошибка. Просто не подключаем.
      contextIsolation: true,
      nodeIntegration: false,
      devTools: !app.isPackaged,   // prod: DevTools недоступен (горячие клавиши и openDevTools() не сработают)
    },
  })
  win.setTitle('ONESHOT')   // фиксируем заголовок окна (не даём HTML <title> перебить)

  if (!app.isPackaged) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
