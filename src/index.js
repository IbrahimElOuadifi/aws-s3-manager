const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const Store = require('electron-store')
const path = require('path')
const { S3 } = require('aws-sdk')
const { readFile, readdir } = require('fs/promises')
const { randexp } = require('randexp')
const { getType } = require('mime')
require('dotenv').config()

const s3 = new S3({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
})

const devTools = true

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
  // mainWindow.setResizable(false)
  // mainWindow.removeMenu()

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
    const { Buckets } = (await s3.listBuckets().promise())
    const buckets = []
    for(const bucket of Buckets) {
      console.log(bucket.Name)
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
    // const buckets = []
    // for(const bucket of Buckets.slice(0, 10)) {
    //   console.log(bucket.Name)
    //   try {
    //     const { Contents } = s3.listObjects({ Bucket: bucket.Name }).promise()
    //     console.log(Buckets.slice(0, 10))
    //       bucket.Contents = Contents
    //       buckets.push(bucket)
    //   bucket.length = Contents.length
    //   } catch ({ message }) {
    //     await dialog.showErrorBox('Error', message)
    //   }
    // }
    console.log(Buckets.sort((a, b) => a.CreationDate - b.CreationDate).slice(0, 10).map(({ CreationDate }) => CreationDate), Buckets.length)
    await dialog.showMessageBox({ type: 'info', message: `Found ${buckets.length} buckets with contents out of ${Buckets.length} total buckets` })
  return { Buckets }
  } catch ({ message }) {
    await dialog.showErrorBox('Error', message)
  }
})


ipcMain.on('submit-create', async ({ reply }, { fields }) => {
  try {
    console.log(fields)

    const { selected_folder, region, bucket_name_chars, bucket_name_length, bucket_number } = fields

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

    const buckets = []
    
    for(let i = 0; i < bucket_number; i++) {
      const bucketName = randexp(`[a-z][${bucket_name_chars}][a-z]{${bucket_name_length - 2}}`)
      await s3.createBucket({ Bucket: bucketName, ACL: 'bucket-owner-read', CreateBucketConfiguration: { LocationConstraint: region } }).promise()
      await s3.putPublicAccessBlock({ Bucket: bucketName, PublicAccessBlockConfiguration: { BlockPublicAcls: false, BlockPublicPolicy: false, IgnorePublicAcls: false, RestrictPublicBuckets: false } }).promise()
      reply('progress', { message: `${i} of ${bucket_number} -- Bucket ${bucketName} created`, index: i, total: bucket_number })
      
      for(const file of files) {
        const extension = file.name.split('.').pop()
        const ContentType = getType(extension)
        await s3.putObject({ Bucket: bucketName, Key: `${bucketName}${file.name.replace('_', '')}`, Body: Buffer.from(file.content), ACL: 'public-read', ContentType  }).promise()
        // await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      console.log(bucketName? `https://${bucketName}.s3.${region}.amazonaws.com` : 'error')
      reply('progress', { message: `${i + 1} of ${bucket_number} -- Put ${files.length} Object${files.length <= 1 ? '' :'s'} in Bucket ${bucketName}`, index: i + 1, total: bucket_number })
      buckets.push(bucketName)
    }
    await dialog.showMessageBox({ type: 'info', message: `Successfully created ${bucket_number} bucket${bucket_number <= 1 ? '' : 's'}!` })
    reply('submit-create-result', { buckets })
  } catch ({ message }) {
    await dialog.showErrorBox('Error', message)
    reply('submit-create-error')
  }
})

// 
ipcMain.on('submit-delete', async ({ reply }, { buckets }) => {
  try {
    reply('submit-delete', { number: buckets.length })
    for(let bucket of buckets) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      console.log(bucket, buckets.indexOf(bucket), buckets.length)
      reply('progress', { message: `${buckets.indexOf(bucket)} of ${buckets.length} -- Deleting bucket ${bucket}`, index: buckets.indexOf(bucket), total: buckets.length })
      const { Contents } = await s3.listObjects({ Bucket: bucket }).promise()
      // const { Contents } = await new Promise((resolve) => setTimeout(resolve({ Contents: [ { Key: '1', Key: '2' } ] }), 1000))
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


ipcMain.on('main-close', () => app.quit())