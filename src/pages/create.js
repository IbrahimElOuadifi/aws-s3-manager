const { ipcRenderer } = require('electron')
const { readdir } = require('fs/promises')

const REGIONS_LIST = [
    'us-east-1',
    'us-east-2',
    'us-west-1',
    'us-west-2',
    'ap-east-1',
    'ap-south-1',
    'ap-northeast-3',
    'ap-northeast-2',
    'ap-southeast-1',
    'ap-southeast-2',
    'ap-northeast-1',
    'ca-central-1',
    'cn-north-1',
    'cn-northwest-1',
    'eu-central-1',
    'eu-west-1',
    'eu-west-2',
    'eu-west-3',
    'eu-north-1',
    'me-south-1',
    'sa-east-1'
]

let selected_folder = null

const setSelectedFolder = async (path, filename) => {
    const files = (await readdir(`${path}\\${filename}`, { withFileTypes: true }))
    .filter((dir) => dir.isFile())
    .map(({ name }) => name)
    Array.from(document.getElementById('folder-details').children).forEach((child) => child.children[0].value === filename ? child.children[0].classList.add('is-dark') : child.children[0].classList.remove('is-dark'))
    document.querySelector('textarea').value = files.length ? files.join('\r\n') : 'No files found'
    selected_folder = `${path}\\${filename}`
}

const setFolderDetail = async (path, files) => {
    document.getElementById('folder-path').value = path
    document.getElementById('folder-details').innerHTML = files.map((file) => folderDetailHtml(file)).join('\n')
    Array.from(document.getElementById('folder-details').children).forEach(child => child.children[0].addEventListener('click', () => setSelectedFolder(path, child.children[0].value)))
    document.getElementById('folder-details').childElementCount && setSelectedFolder(path, document.getElementById('folder-details').children[0].children[0].value)
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('folder-path').addEventListener('click', () => ipcRenderer.invoke('folder-path-select', { defaultPath: document.getElementById('folder-path').value }).then(({ files, path }) => setFolderDetail(path, files)))
    document.getElementById('main-close').addEventListener('click', () => ipcRenderer.send('main-close'))
    document.getElementById('main-submit').addEventListener('click', () => {
        const fields = {
            selected_folder,
            region: document.getElementById('select-region').value,
            bucket_name_chars: Array.from(document.querySelectorAll('.bucket-name-char.is-dark')).map((el) => el.getAttribute('data-pattern')).join(''),
            bucket_name_length: document.getElementById('bucket-name-length').value,
            bucket_number: document.getElementById('bucket-number').value
        }
        ipcRenderer.send('submit-create', { fields })
    })
    Array.from(document.querySelectorAll('.bucket-name-char')).forEach((element) => element.addEventListener('click', () => {
        if(element.value !== 'LOWERCASE') element.classList.toggle('is-dark')
    }))

    document.getElementById('select-region').innerHTML = REGIONS_LIST.map((region) => `<option value="${region}">${region}</option>`).join('\n')
})

const folderDetailHtml = (filename) => `<div class="field"><input class="button is-fullwidth is-small" type="button" value="${filename}"></div>`

ipcRenderer.invoke('get-default-path').then(({ files, path }) => setFolderDetail(path, files))

ipcRenderer.on('submit-create', () => {
    document.getElementById('frame-detail').classList.add('is-hidden')
    document.getElementById('frame-result').classList.remove('is-hidden')
    document.getElementById('main-stop').parentElement.classList.remove('is-hidden')
    document.getElementById('main-submit').parentElement.classList.add('is-hidden')
    document.getElementById('buckets').value = 'Creating buckets...'
    document.getElementById('buckets').parentElement.classList.add('is-loading')

})

ipcRenderer.on('progress', (_, { message, index, total }) => {
    document.getElementById('message').value = message
    document.getElementById('progress').value = index
    document.getElementById('progress').max = total
})

ipcRenderer.on('message', (_, { message }) => {
    document.getElementById('message').value = message
})

ipcRenderer.on('submit-create-result', (_, { buckets }) => {
    document.getElementById('main-stop').parentElement.classList.add('is-hidden')
    document.getElementById('main-cancel').parentElement.classList.remove('is-hidden')
    document.getElementById('buckets').parentElement.classList.remove('is-loading')
    document.getElementById('buckets').value = buckets.join('\r\n')
})

ipcRenderer.on('submit-create-error', () => {
    document.getElementById('main-stop').parentElement.classList.add('is-hidden')
    document.getElementById('main-cancel').parentElement.classList.remove('is-hidden')
    document.getElementById('buckets').parentElement.classList.remove('is-loading') 
})

document.getElementById('main-stop').addEventListener('click', () => {
    ipcRenderer.send('submit-stop')
})

document.getElementById('main-cancel').addEventListener('click', () => {
    document.getElementById('main-cancel').parentElement.classList.add('is-hidden')
    document.getElementById('main-submit').parentElement.classList.remove('is-hidden')
    document.getElementById('frame-detail').classList.remove('is-hidden')
    document.getElementById('frame-result').classList.add('is-hidden')
    document.getElementById('message').value = ''
    document.getElementById('progress').value = 0
    document.getElementById('progress').max = 0
    document.getElementById('buckets').value = ''
})