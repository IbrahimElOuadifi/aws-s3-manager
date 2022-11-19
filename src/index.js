const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { readdir } = require('fs/promises')

const devTools = true

if (require('electron-squirrel-startup')) {
  app.quit()
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools,
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'index.html'))
  mainWindow.setResizable(false)
  mainWindow.removeMenu()

  if (devTools) mainWindow.webContents.openDevTools()
}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.on('folder-path-select', async ({ reply }) => {
  const path = dialog.showOpenDialogSync({
    properties: ['openDirectory'],
  })
  const files = await readdir(path[0])
  reply('folder-path-reply', { files, path: path[0] })
  console.log(files, path[0])
})
