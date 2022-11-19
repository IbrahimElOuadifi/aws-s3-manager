const { ipcRenderer } = require('electron')

document.addEventListener('DOMContentLoaded', () => {
    const folder_path = document.getElementById('folder-path')
    const folder_detail = document.getElementById('folder-detail')

    folder_path.addEventListener('click', () => ipcRenderer.send('folder-path-select'))
})

ipcRenderer.on('folder-path-reply', (_, arg) => {
    console.log(arg)
})


`<div class="field">
<input
  class="button is-fullwidth is-small is-dark"
  type="button"
  value="Offer Name"
/>`