const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const Store = require('electron-store')
const path = require('path')
const { S3 } = require('aws-sdk')
const { readFile, writeFile, readdir } = require('fs/promises')
const { randexp } = require('randexp')
const { getType } = require('mime')

let s3 = new S3()

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

ipcMain.handle('check-login', async () => {
  const store = new Store()
  if (!store.has('credentials')) return { success: false }

  const credentials = JSON.parse(store.get('credentials'))

  // s3.config.update({
  //   accessKeyId: credentials.accessKeyId,
  //   secretAccessKey: credentials.secretAccessKey,
  //   region: credentials.region
  // })
  s3 = new S3({
    region: credentials.region,
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey
  })
  return { success: true, credentials }
})

ipcMain.handle('save-login', async (_, { accessKeyId, secretAccessKey, region }) => {
  try {
    await new S3({ region, accessKeyId, secretAccessKey }).listBuckets().promise()
    await dialog.showMessageBox({ message: 'Login successful' })
    new Store().set('credentials', JSON.stringify({ accessKeyId, secretAccessKey, region }))
    // s3.config.update({ accessKeyId, secretAccessKey, region })
    s3 = new S3({ region, accessKeyId, secretAccessKey })
    return { success: true }
  } catch ({ message }) {
    await dialog.showMessageBox({ type: 'error', message })
    return { success: false }
  }
})

ipcMain.handle('disconnect', async () => {
  new Store().delete('credentials')
  await dialog.showMessageBox({ message: 'Disconnected' })
  return { success: true }
})

ipcMain.handle('get-last-buckets', async (_, { number }) => {
  if(!number || isNaN(number)) {
    await dialog.showErrorBox('Error', 'Please enter a number')
    return { buckets: [] }
  } else if(number < 1) {
    await dialog.showErrorBox('Error', 'Please enter a number greater than 0')
    return { buckets: [] }
  }
  const { Buckets } = await s3.listBuckets().promise()
  const buckets = Buckets.sort((a, b) => a.CreationDate - b.CreationDate).map(({ Name }) => Name).slice(0, number)
  return { buckets }
})

ipcMain.handle('get-empty-buckets', async ({ sender }) => {
  try {
    let isStopeed = false

    ipcMain.once('submit-stop-check-emptys',async () => isStopeed = true)
    
    const { Buckets } = (await s3.listBuckets().promise())
    const buckets = []
    for(const bucket of Buckets) {
      console.log(bucket.Name)
      if(isStopeed) break
      try {
        sender.send('progress', { index: Buckets.indexOf(bucket), total: Buckets.length, message: `Checking bucket ${bucket.Name} ${Buckets.indexOf(bucket)} of ${Buckets.length}` })
        const { Contents } = await s3.listObjects({ Bucket: bucket.Name }).promise()
        console.log(Contents.length)
        if(Contents.length === 0) {
        buckets.push(bucket.Name)
      }
      bucket.length = Contents.length
      } catch ({ message }) {
        await dialog.showErrorBox('Error', message)
      }
    }
    console.log(buckets, Buckets.length)
    await dialog.showMessageBox({ type: 'info', message: `Found ${buckets.length} empty buckets out of ${Buckets.length} total buckets` })
  return { buckets }
  } catch ({ message }) {
    await dialog.showErrorBox('Error', message)
  }
})

ipcMain.handle('get-buckets-with-contents', async () => {
  try {
    const { Buckets } = (await s3.listBuckets().promise())

    console.log({ type: 'info', message: `Found ${Buckets.length} buckets with contents out of ${Buckets.length} total buckets` })
  return { buckets: Buckets }
  } catch ({ message }) {
    await dialog.showErrorBox('Error', message)
  }
})


ipcMain.on('submit-create', async ({ reply }, { fields }) => {
  const buckets = []
  try {
    console.log(fields)

    const { selected_folder, region, bucket_name_chars, bucket_name_length, bucket_number } = fields

    if(!selected_folder) return await dialog.showErrorBox('Error', 'Please select a folder')

    if(!region) return await dialog.showErrorBox('Error', 'Please select a region')

    if(!bucket_name_chars) return await dialog.showErrorBox('Error', 'Please enter a bucket name character set')

    if(!bucket_name_length) return await dialog.showErrorBox('Error', 'Please enter a bucket name length')

    if(!isNaN(bucket_name_length) && bucket_name_length < 5 && bucket_name_length > 63) return await dialog.showErrorBox('Error', 'Please enter a bucket name length between 5 and 63')

    if(!bucket_number) return await dialog.showErrorBox('Error', 'Please enter a number of buckets to create')

    if(isNaN(bucket_number)) return await dialog.showErrorBox('Error', 'Please enter a number of buckets to create')

    if(bucket_number < 1 || bucket_number > 50) return await dialog.showErrorBox('Error', 'Please enter a number of buckets to create between 1 and 50')

    const files = (await readdir(selected_folder, { withFileTypes: true })).filter((dir) => dir.isFile()).map(({ name }) => ({name, path: `${selected_folder}\\${name}`}))
    console.log(files)

    for(const file of files) {
      const content = await readFile(file.path)
      file.content = content
    }

    if(!selected_folder && !region && !bucket_name_chars && !bucket_name_length && !bucket_number) {
      await dialog.showMessageBox({ type: 'error', message: 'Please fill all fields' })
      return reply('submit-create-error')
    }

    if(bucket_number.length < 1) {
      await dialog.showMessageBox({ type: 'error', message: 'Please create at least one bucket' })
      return reply('submit-create-error')
    }

    if(bucket_name_length < 5 || bucket_name_length > 63) {
      await dialog.showMessageBox({ type: 'error', message: 'Bucket name length must be between 5 and 63 characters' })
      return reply('submit-create-error')
    }


    reply('submit-create', { bucket_number })

    let isStopeed = false

    ipcMain.once('submit-stop',async () => isStopeed = true)
    
    for(let i = 0; i < bucket_number; i++) {

      if(isStopeed) break

      const bucketName = randexp(`[a-z][${bucket_name_chars}][a-z]{${bucket_name_length - 2}}`)
      await s3.createBucket({ Bucket: bucketName, ACL: 'bucket-owner-read' }).promise()
      await s3.putPublicAccessBlock({ Bucket: bucketName, PublicAccessBlockConfiguration: { BlockPublicAcls: false, BlockPublicPolicy: false, IgnorePublicAcls: false, RestrictPublicBuckets: false } }).promise()
      reply('progress', { message: `${i} of ${bucket_number} -- Bucket ${bucketName} created`, index: i, total: bucket_number })
      
      for(const file of files) {
        const extension = file.name.split('.').pop()
        const ContentType = getType(extension)
        await s3.putObject({ Bucket: bucketName, Key: file.name.replace('_', bucketName), Body: Buffer.from(file.content), ACL: 'public-read', ContentType  }).promise()
        reply('progress', { message: `${i} of ${bucket_number} -- File ${file.name} uploaded to ${bucketName}`, index: i, total: bucket_number })
      }

      console.log(bucketName? `https://${bucketName}.s3.${region}.amazonaws.com` : 'error')
      reply('progress', { message: `${i + 1} of ${bucket_number} -- Put ${files.length} Object${files.length <= 1 ? '' :'s'} in Bucket ${bucketName}`, index: i + 1, total: bucket_number })
      buckets.push(bucketName)
    }
    await dialog.showMessageBox({ type: 'info', message: `Successfully created ${buckets.length} bucket${bucket_number <= 1 ? '' : 's'}!` })
    reply('submit-create-result', { buckets })
  } catch ({ message }) {
    await dialog.showErrorBox('Error', message)
    reply('submit-create-error', { buckets })
  }
})

ipcMain.on('submit-delete', async ({ reply }, { buckets }) => {
  try {
    reply('submit-delete', { number: buckets.length })
    for(let bucket of buckets) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      console.log(bucket, buckets.indexOf(bucket), buckets.length)
      reply('progress', { message: `${buckets.indexOf(bucket)} of ${buckets.length} -- Deleting bucket ${bucket}`, index: buckets.indexOf(bucket), total: buckets.length })
      const { Contents } = await s3.listObjects({ Bucket: bucket }).promise()
      if(Contents.length) {
        await s3.deleteObjects({ Bucket: bucket, Delete: { Objects: Contents.map(({ Key }) => ({ Key })) } }).promise()
        reply('message', { message: `${buckets.indexOf(bucket)} of ${buckets.length} -- Deleted ${Contents.length} object${Contents.length <= 1 ? '' :'s'} from ${bucket}` })
      } else {
        reply('message', { message: `Bucket ${bucket} is empty` })
      }
      await s3.deleteBucket({ Bucket: bucket }).promise()
      reply('progress', { message: `${buckets.indexOf(bucket) + 1} of ${buckets.length} -- Deleted bucket ${bucket}`, index: buckets.indexOf(bucket) + 1, total: buckets.length })
    }
    await dialog.showMessageBox({ type: 'info', message: 'All buckets deleted' })
    reply('complete-delete')
  } catch ({ message }) {
    await dialog.showMessageBox({ type: 'error', message })
  }

  reply('submit-delete-result', { buckets })
})

ipcMain.on('export-buckets', async (_, { buckets }) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog({ title: 'Export buckets', defaultPath: 'buckets.txt' })
    if(canceled) return console.log('canceled')
    await writeFile(filePath, buckets.join('\r\n'))
  } catch ({ message }) {
    await dialog.showErrorBox('Error', message)
  }
})

ipcMain.handle('request-confirm', async (_, { message }) => {
  const { response } = await dialog.showMessageBox({ type: 'question', message, buttons: ['Yes', 'No'] })
  return response === 0
})

ipcMain.on('main-close', () => app.quit()) 