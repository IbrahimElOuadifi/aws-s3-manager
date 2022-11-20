const { ipcRenderer } = require('electron')
const { readdir } = require('fs/promises')

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
    document.getElementById('main-back').addEventListener('click', () => ipcRenderer.send('main-back'))
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
})

const folderDetailHtml = (filename) => `<div class="field"><input class="button is-fullwidth is-small" type="button" value="${filename}"></div>`

ipcRenderer.invoke('get-default-path').then(({ files, path }) => setFolderDetail(path, files))

ipcRenderer.on('submitted', (_, { buckets }) => {
    document.querySelector('textarea').value = buckets.join('\r\n')
    selected_folder = null
})