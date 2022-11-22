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
  console.log(number)
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
        console.log(message)
      }
    }
    console.log(buckets, Buckets.length)
  return { buckets }
  } catch ({ message }) {
    console.log(message)
  }
})

ipcMain.on('submit-create', async ({ reply }, { fields }) => {
  try {
    console.log(fields)

    // selected_folder
    // region
    // bucket_name_chars
    // bucket_name_length
    // bucket_number

    const { selected_folder, region, bucket_name_chars, bucket_name_length, bucket_number } = fields

    const files = (await readdir(selected_folder, { withFileTypes: true })).filter((dir) => dir.isFile()).map(({ name }) => ({name, path: `${selected_folder}\\${name}`}))
    console.log(files)

    for(const file of files) {
      // const content = createReadStream(file.path).on('error', (err) => console.log(err))
      const content = await readFile(file.path)
      file.content = content
    }

    const buckets = []
    
    for(let i = 0; i < bucket_number; i++) {
      const bucketName = randexp(`[a-z][${fields.bucket_name_chars}][a-z]{${fields.bucket_name_length - 2}}`)
      console.log(bucketName)
      await s3.createBucket({ Bucket: bucketName, ACL: 'public-read', CreateBucketConfiguration: { LocationConstraint: fields.region } }).promise()
      await s3.putPublicAccessBlock({ Bucket: bucketName, PublicAccessBlockConfiguration: { BlockPublicAcls: false, BlockPublicPolicy: false, IgnorePublicAcls: false, RestrictPublicBuckets: false } }).promise()
      
      for(const file of files) {
        const extension = file.name.split('.').pop()
        const ContentType = getType(extension)
        console.log(ContentType, 'extension')
        await s3.putObject({ Bucket: bucketName, Key: `${bucketName}${file.name.replace('_', '')}`, Body: Buffer.from(file.content), ACL: 'public-read', ContentType  }).promise()
      }

      console.log(bucketName? `https://${bucketName}.s3.${region}.amazonaws.com` : 'error')
    }
    reply('submitted', { buckets })
  } catch ({ message }) {
    console.log(message)
  }
})

// 
ipcMain.on('submit-delete', async ({ reply }, { buckets }) => {
  try {
    for(bucket of buckets) {
      const { Contents } = await s3.listObjects({ Bucket: bucket }).promise()
      if(Contents.length) {
        await s3.deleteObjects({ Bucket: bucket, Delete: { Objects: Contents.map(({ Key }) => ({ Key })) } }).promise()
        reply('message', { message: `Deleted ${Contents.length} objects from ${bucket}` })
      } else {
        reply('message', { message: `Bucket ${bucket} is empty` })
      }
      await s3.deleteBucket({ Bucket: bucket }).promise()
      reply('message', { message: `Deleted bucket ${bucket}` })
    }
    reply('completed')
  } catch ({ message }) {
    console.log(message, 'error')
  }


//  delete all objects in bucket
// s3.listObjects({
//     Bucket: 'fdbkiicvkxu03'
// }, (err, data) => {
//     if (err) {
//         console.log(err.message)
//     } else {
//         // delete many objects
//         s3.deleteObjects({
//             Bucket: 'fdbkiicvkxu03',
//             Delete: {
//                 Objects: data.Contents.map(({ Key }) => ({ Key }))
//             }
//         }, (err, data) => {
//             if (err) {
//                 console.log(err.message)
//             } else {
//                 console.log(data)
//                 s3.deleteBucket({
//                     Bucket: 'my-bucket-tgerzgzfzaefazef'
//                 }, (err, data) => {
//                     if (err) {
//                         console.log(err.message)
//                     } else {
//                         console.log(data)
//                     }
//                 })
//             }
//         })
        
//     }
// })


  reply('submitted', { buckets })
})


ipcMain.on('main-close', () => app.quit())