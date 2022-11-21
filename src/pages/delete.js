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
        ipcRenderer.invoke('get-last-buckets', { number }).then(({ buckets }) => {
            document.getElementById('buckets').value = buckets.join('\n')
        })
    })

    document.getElementById('button-empty-buckets').addEventListener('click', () => {
        ipcRenderer.invoke('get-empty-buckets').then(({ buckets }) => {
            document.getElementById('buckets').value = buckets.join('\n')
        })
    })
})

ipcRenderer.on('submitted', () => {
    document.getElementById('main-cancel').parentElement.classList.remove('is-hidden')
    document.getElementById('main-submit').parentElement.classList.add('is-hidden')
})

ipcRenderer.on('progress', (_, { index, total, message }) => {
    console.log(index, total, message, document.getElementById('progress'), document.getElementById('notif'))
    document.getElementById('progress').value = index
    document.getElementById('progress').max = total
    document.getElementById('notif').value = message
})

ipcRenderer.on('message', (_, { message }) => {
    document.getElementById('notif').value = message
})

ipcRenderer.on('completed', () => {
    document.getElementById('main-cancel').parentElement.classList.add('is-hidden')
    document.getElementById('main-submit').parentElement.classList.remove('is-hidden')
})