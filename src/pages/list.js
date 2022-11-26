const { ipcRenderer } = require('electron')

let buckets_list = []

const max_items = 9

const getPage = (buckets, page) => {
    try {
    const last_page = buckets.length ? Math.ceil(buckets.length / max_items) : 0
    const start = (page - 1) * max_items
    const end = start + max_items
    const buckets_page = buckets.slice(start, end)
    const bucket_table = document.querySelector('#buckets-table tbody')
    const pagination = document.getElementById('pagination')
    pagination.innerHTML = ''
    const button_prev = document.createElement('a')
    button_prev.classList.add('pagination-previous')
    button_prev.innerText = 'Previous'
    const button_next = document.createElement('a')
    button_next.classList.add('pagination-next')
    button_next.innerText = 'Next page'
    const pagination_list = document.createElement('ul')
    pagination_list.classList.add('pagination-list')
    pagination.appendChild(button_prev)
    pagination.appendChild(button_next)
    pagination.appendChild(pagination_list)

    for(let i = 1; i <= last_page; i++) {
        if(last_page <= 5) {
            const pagination_item = document.createElement('li')
            pagination_item.innerHTML = `<a class="pagination-link" aria-label="Goto page ${i}">${i}</a>`
            pagination_item.children[0].addEventListener('click', () => getPage(buckets, i))
            pagination_list.appendChild(pagination_item)
        } else {
            if(i === 1 || i === last_page || i === page || i === page - 1 || i === page + 1) {
                const pagination_item = document.createElement('li')
                pagination_item.innerHTML = `<a class="pagination-link ${i === page ? 'is-current' : ''}" aria-label="Goto page ${i}">${i}</a>`
                if(i !== page) pagination_item.children[0].addEventListener('click', () => getPage(buckets, i))
                pagination_list.appendChild(pagination_item)
            } else if((i === page - 2 && page - 2 !== 1) || (i === page + 2 && page + 2 !== last_page)) {
                const pagination_item = document.createElement('li')
                pagination_item.innerHTML = `<span class="pagination-ellipsis">&hellip;</span>`
                pagination_list.appendChild(pagination_item)
            }
        }
    }

    if(page > 1) {
        button_prev.classList.remove('is-disabled')
        button_prev.addEventListener('click', () => getPage(buckets, page - 1))
    } else {
        button_prev.classList.add('is-disabled')
    }
    if(page < last_page) {
        button_next.classList.remove('is-disabled')
        button_next.addEventListener('click', () => getPage(buckets, page + 1))
    } else {
        button_next.classList.add('is-disabled')
    }

    bucket_table.innerHTML = ''

    if(buckets.length) {
        buckets_page.forEach(bucket => {
            const row = document.createElement('tr')
            const name = document.createElement('td')
            name.innerText = bucket.Name
            const creation_date = document.createElement('td')
            creation_date.innerText = bucket.CreationDate.toDateString()
            const length = document.createElement('td')
            length.innerText = bucket.length
            row.appendChild(name)
            row.appendChild(creation_date)
            row.appendChild(length)
            bucket_table.appendChild(row)
        })
    } else {
        const row = document.createElement('tr')
        const column = document.createElement('td')
        column.colSpan = 99
        column.classList.add('has-text-centered')
        column.innerText = 'no buckets found !'
        row.appendChild(column)
        bucket_table.appendChild(row)
    }

    
        
    } catch ({ message }) {
        alert(message)
    }
    
}

const filter = ({ searchTerm, date }) => {
    const filtered_buckets = buckets_list.filter(bucket => bucket.Name.includes(searchTerm)).filter(bucket => bucket.CreationDate.toDateString().includes(date))
    getPage(filtered_buckets, 1)
}

document.addEventListener('DOMContentLoaded', async () => {

    const { success } = await ipcRenderer.invoke('check-login')
    if (!success) return window.location.href = './account.html'
    
    document.getElementById('main-close').addEventListener('click', () => ipcRenderer.send('main-close'))

    const row = document.createElement('tr')
    const column = document.createElement('td')
    column.colSpan = 99
    column.classList.add('has-text-centered')
    column.innerText = 'loading buckets... please wait !'
    row.appendChild(column)
    document.querySelector('#buckets-table tbody').appendChild(row)

    const button_prev = document.createElement('a')
    button_prev.classList.add('pagination-previous')
    button_prev.classList.add('is-disabled')
    button_prev.innerText = 'Previous'
    const button_next = document.createElement('a')
    button_next.classList.add('pagination-next')
    button_next.classList.add('is-disabled')
    button_next.innerText = 'Next page'
    const pagination_list = document.createElement('ul')
    pagination_list.classList.add('pagination-list')
    document.getElementById('pagination').appendChild(button_prev)
    document.getElementById('pagination').appendChild(button_next)
    document.getElementById('pagination').appendChild(pagination_list)
    
    

    ipcRenderer.invoke('get-buckets-with-contents').then(({ buckets }) => {
        try {
            buckets_list = buckets.sort((a, b) => a.CreationDate - b.CreationDate)
            filter({ searchTerm: '', date: '' })
        } catch ({ message }) {
            alert(JSON.stringify(message))
        }

        // document.querySelector('textarea').value = JSON.stringify(buckets, null, 2)
    })

    document.getElementById('search').addEventListener('input', ({ target }) => {
        filter({ searchTerm: target.value, date: document.getElementById('date').value })
    })

    document.getElementById('date').addEventListener('input', ({ target }) => {
        filter({ searchTerm: document.getElementById('search').value, date: target.value })
    })   
})