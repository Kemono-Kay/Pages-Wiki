/* eslint-env browser */

var config
const params = decodeQueryParams()
xhr('./data/config.json', loadWiki)

var footer = false
var nav = false
var article = false

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
  if (!window.location.search) { params.title = Object.keys(config.pages)[0]; return updateQueryParams() }
  if (!params.s && !Object.keys(config.pages).includes(params.title)) { params.s = params.title; return updateQueryParams() }
  if (params.s && Object.keys(config.pages).includes(params.title)) { params.title = params.s; delete params.s; return updateQueryParams() }

  if (config.footer) {
    if (typeof config.footer === 'string') {
      xhr(`./data/${config.footer}`, loadFooterMD)
    } else {
      loadFooter(config.footer)
    }
  }

  if (config.nav) {
    if (typeof config.nav === 'string') {
      xhr(`./data/${config.nav}`, loadNavMD)
    } else {
      loadNav(config.nav)
    }
  }

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

function loadArticlePage (e) {
  document.title = `${params.title.replace('_', ' ')} - ${config.title}`
  // TODO markdown
  article = parseMD(e.currentTarget.responseText)
  loadPageIfReady()
}

// Search functionality while remaining on the same page

function autocompleteArticle (query) {
  const words = query.split(' ').filter(s => s)
  const search = new RegExp(words
    .map((s, i) => `(?=.*\\b${s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}${i + 1 >= words.length && !query.endsWith(' ') ? '\\b' : ''})`)
    .join('') + '.+', 'i')
  return config.pages.filter(page => search.test(page.replace('_', '')))
}

// Search page loading

function loadSearchPage () {
  document.title = `${params.s} - Search results - ${config.title}`
  const searchWorker = new Worker('search.js')
  searchWorker.postMessage({ search: params.s, pages: Object.keys(config.pages) })
  searchWorker.addEventListener('message', loadSearchResults)
}

function loadSearchResults (result) {
  // TODO result.data
  article = result.data
  loadPageIfReady()
}

// Page loading in general

function loadLinkList (arr) {
  return arr.map(t => `<a href="?s=${encodeURIComponent(t)}">${t.replace('_', ' ')}</a>`).join('')
}
function parseMD (content) {
  // TODO
  return content
}

function loadFooter (arr) {
  footer = loadLinkList(arr)
  loadPageIfReady()
}
function loadFooterMD (e) {
  footer = parseMD(e.currentTarget.responseText)
  loadPageIfReady()
}
function loadNav (arr) {
  nav = loadLinkList(arr)
  loadPageIfReady()
}
function loadNavMD (e) {
  nav = parseMD(e.currentTarget.responseText)
  loadPageIfReady()
}

function getPageHTML (mainContent, footerContent, navContent) {
  return `\
<main>
  ${mainContent}
</main>
<nav aria-labelledby="navh-a">
  <h2 id="navh-a"class="hideThis">Navigation menu</h2>
  <form role="search" autocomplete="off">
    <input type="search" role="searchbox" id="search" name="s" required minlength="1">
    <button id="submitSearch" aria-label="Go">🔍</button>
  </form>
  <hr>
  ${navContent}
</nav>
<footer>
  ${footerContent}
</footer>`
}

function loadPageIfReady () {
  if (!(footer && nav && article)) return

  document.body.removeAttribute('aria-describedby')
  document.body.innerHTML = getPageHTML(article, footer, nav)
  document.body.removeAttribute('aria-busy')
  // TODO attach functions
}
