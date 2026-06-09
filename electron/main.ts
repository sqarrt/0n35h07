import { app, BrowserWindow } from 'electron'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Десктоп: разрешаем звук без пользовательского жеста (музыка/SFX стартуют сразу при запуске).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required')

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    title: 'ONESHOT',
    icon: path.join(__dirname, '../build/icon.png'),   // иконка окна (dev); упакованную ставит electron-builder
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
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
