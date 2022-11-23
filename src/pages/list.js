const { ipcRenderer } = require('electron')

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('main-close').addEventListener('click', () => ipcRenderer.send('main-close'))

    ipcRenderer.invoke('get-buckets-with-contents').then(({ buckets }) => {
        // const list = document.getElementById('list')
        // buckets.forEach(bucket => {
        //     const li = document.createElement('li')
        //     li.innerText = bucket
        //     list.appendChild(li)
        // })

        document.querySelector('textarea').value = JSON.stringify(buckets, null, 2)
    })
})