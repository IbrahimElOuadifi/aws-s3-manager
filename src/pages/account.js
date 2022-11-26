const { ipcRenderer } = require('electron')

const REGIONS_LIST = [
    { label: 'US East (N. Virginia)', value: 'us-east-1' },
    { label: 'US East (Ohio)', value: 'us-east-2' },
    { label: 'US West (N. California)', value: 'us-west-1' },
    { label: 'US West (Oregon)', value: 'us-west-2' },
    { label: 'Canada (Central)', value: 'ca-central-1' },
    { label: 'EU (Ireland)', value: 'eu-west-1' },
    { label: 'EU (London)', value: 'eu-west-2' },
    { label: 'EU (Paris)', value: 'eu-west-3' },
    { label: 'EU (Frankfurt)', value: 'eu-central-1' },
    { label: 'Asia Pacific (Tokyo)', value: 'ap-northeast-1' },
    { label: 'Asia Pacific (Seoul)', value: 'ap-northeast-2' },
    { label: 'Asia Pacific (Osaka-Local)', value: 'ap-northeast-3' },
    { label: 'Asia Pacific (Singapore)', value: 'ap-southeast-1' },
    { label: 'Asia Pacific (Sydney)', value: 'ap-southeast-2' },
    { label: 'Asia Pacific (Mumbai)', value: 'ap-south-1' },
    { label: 'South America (São Paulo)', value: 'sa-east-1' },
]
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('main-close').addEventListener('click', () => ipcRenderer.send('main-close'))
    
        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault()
            const form = e.target
            const data = {
                accessKeyId: form['access-key']?.value,
                secretAccessKey: form['secret-key']?.value,
                region: form?.region?.value,
            }
            try {
                form['button-connect'].disabled = true
                form['button-connect'].classList.add('is-loading')
                await ipcRenderer.invoke('save-login', data)
                form['button-connect'].disabled = false
                form['button-connect'].classList.remove('is-loading')
            } catch ({ message }) {
                alert(message)
                form['button-connect'].disabled = false
                form['button-connect'].classList.remove('is-loading')
            }
        })

        document.getElementById('button-disconnect').addEventListener('click', async ({ target }) => {
            try {
                target.disabled = true
                target.classList.add('is-loading')
                await ipcRenderer.invoke('disconnect')
                const form = document.getElementById('login-form')
                form['access-key'].value = ''
                form['secret-key'].value = ''
                form['region'].value = ''
                target.disabled = false
                target.classList.remove('is-loading')
            } catch ({ message }) {
                alert(message)
            }
        })
    
        document.getElementById('region').innerHTML = REGIONS_LIST.map(region => `<option value="${region.value}">${region.label}</option>`).join('')

        ipcRenderer.invoke('check-login').then(({ success, credentials }) => {
            if (!success) return
            document.getElementById('access-key').value = credentials.accessKeyId
            document.getElementById('secret-key').value = credentials.secretAccessKey
            document.getElementById('region').value = credentials.region
        })

        $(document).ready(function() {
            $('#region').select2({
                theme: 'bootstrap4',
                width: '100%',
                placeholder: 'Select a region',
            })
        })
    })

    $(document).ready(function () {
        $('#region').selectize({
            sortField: 'text'
        })
    })