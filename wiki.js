/* eslint-env browser */

var config
const params = decodeQueryParams()
xhr('./data/config.json', loadWiki)

function xhr (page, cb) {
  const xhr = new XMLHttpRequest()
  xhr.addEventListener('load', cb)
  xhr.open('GET', page)
  xhr.send()
}

function loadWiki (e) {
  if (this.status !== 200) return handleError('Configuration not loaded', this.status)
  try { config = JSON.parse(this.responseText) } catch (e) { return handleError('Invalid configuartion', e) }
  if (!config.pages) return handleError('Wiki has no pages')
  if (!params.s && !config.pages.includes(params.title)) { params.s = params.title; return updateQueryParams() }
  if (params.s && config.pages.includes(params.title)) { params.title = params.s; delete params.s; return updateQueryParams() }
  if (params.s) return loadSearchPage()
  return xhr(`./data/${params.title}.md`, loadArticlePage)
}

/* function getScript (location, cb) {
  var script = document.createElement('script')
  script.addEventListener('load', cb, { once: true })
  script.src = location
  document.head.appendChild(script)
} */

function handleError (error, details) {
  document.body.innerHTML = `<main class="error"><h1>${error}</h1><pre>${details}</pre></main>`
}

function decodeQueryParams () {
  if (!window.location.search) return {}
  const params = {}
  window.location.search.slice(1).split('&').forEach(p => {
    const pair = p.split('=')
    params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1])
  })
  return params
}

function updateQueryParams () {
  var string = ''
  Object.keys(params).map(p => {
    string += `&${encodeURI(p)}=${encodeURI(params[p])}`
  })
  window.location.search = `?${string.slice(1)}`
}

// Article loading

function loadArticlePage (content) {
  document.title = `${params.title.replace('_', ' ')} - ${config.title}`
}

// Search page loading

function loadSearchPage () {
  document.title = `${params.s} - Search results - ${config.title}`
  const searchWorker = new Worker('search.js')
  searchWorker.postMessage([params.s, config.pages])
  searchWorker.addEventListener('message', addSearchResult)
}

function addSearchResult (result) {

}
