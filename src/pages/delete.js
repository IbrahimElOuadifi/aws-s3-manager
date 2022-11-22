const { ipcRenderer } = require('electron')

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('main-close').addEventListener('click', () => ipcRenderer.send('main-close'))
    
    document.getElementById('main-submit').addEventListener('click', () => {
        const buckets = document.getElementById('buckets').value.split('\n')
        ipcRenderer.send('submit-delete', { buckets })
    })

    document.getElementById('main-cancel').addEventListener('click', () => {
        document.getElementById('main-cancel').parentElement.classList.add('is-hidden')
        document.getElementById('main-submit').parentElement.classList.remove('is-hidden')
    })

    document.getElementById('button-last-buckets').addEventListener('click', () => {
        const number = document.getElementById('input-number-buckets').value
        document.getElementById('buckets').parentElement.classList.add('is-loading')
        ipcRenderer.invoke('get-last-buckets', { number }).then(({ buckets }) => {
            document.getElementById('buckets').value = buckets.join('\n')
            document.getElementById('buckets').parentElement.classList.remove('is-loading')
        })
    })

    document.getElementById('button-empty-buckets').addEventListener('click', () => {
        ipcRenderer.invoke('get-empty-buckets').then(({ buckets }) => {
            document.getElementById('buckets').value = buckets.join('\n')
        })
    })
})

ipcRenderer.on('submit-delete', () => {
    document.getElementById('main-cancel').parentElement.classList.remove('is-hidden')
    document.getElementById('main-submit').parentElement.classList.add('is-hidden')
})

ipcRenderer.on('progress', (_, { index, total, message }) => {
    document.getElementById('progress').value = index
    document.getElementById('progress').max = total
    document.getElementById('message').value = message
})

ipcRenderer.on('message', (_, { message }) => {
    document.getElementById('message').value = message
})

ipcRenderer.on('completed', () => {
    document.getElementById('main-cancel').parentElement.classList.add('is-hidden')
    document.getElementById('main-submit').parentElement.classList.remove('is-hidden')
})