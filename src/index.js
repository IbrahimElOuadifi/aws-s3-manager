const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const Store = require('electron-store')
const path = require('path')
const { readdir } = require('fs/promises')
const { randexp } = require('randexp')

const devTools = false

if (require('electron-squirrel-startup')) {
  app.quit()
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      devTools,
    },
  })

  mainWindow.loadFile(path.join(__dirname, './pages/create.html'))
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

ipcMain.handle('folder-path-select', async (_, { defaultPath }) => {
  const { filePaths: [path], canceled } = await dialog.showOpenDialog({ properties: ['openDirectory'], defaultPath })
  if(canceled) return console.log('canceled')
  new Store().set('offers-path', path)
  // new Store().set('offers-path', path)
  const files = (await readdir(path, { withFileTypes: true }))
    .filter((dir) => dir.isDirectory())
    .map(({ name }) => name)
  console.log(files, path)
  return { files, path: path }
})

ipcMain.handle('get-default-path', async () => {
  const path = new Store().has('offers-path') ? new Store().get('offers-path') : app.getPath('documents')
  const files = (await readdir
  (path, { withFileTypes: true }))
    .filter((dir) => dir.isDirectory())
    .map(({ name }) => name)
  return { files, path }
})

ipcMain.on('submit-create', ({ reply }, { fields }) => {
  console.log(fields)

  // selected_folder
  // region
  // bucket_name_chars
  // bucket_name_length
  // bucket_number

  const buckets = []
  
  for(let i = 0; i < fields.bucket_number; i++) {
    const bucketName = randexp(`[a-z][${fields.bucket_name_chars}][a-z]{${fields.bucket_name_length - 2}}`)
    buckets.push(bucketName)
  }

  reply('submitted', { buckets })
})


ipcMain.on('main-close', () => app.quit())