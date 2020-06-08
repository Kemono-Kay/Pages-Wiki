/* eslint-env browser */

(function () {
  var config
  const params = decodeQueryParams()
  xhr('./data/config.json', loadWiki)

  var MD = getMDInfo()
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
    // TODO prepare result.data in a nicer way.
    article = result.data
    loadPageIfReady()
  }

  // Page loading in general

  function loadLinkList (arr) {
    return arr.map(t => `<a href="?s=${encodeURIComponent(t)}">${t.replace('_', ' ')}</a>`).join('')
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
    <div class="searchAutocomplete"><div class="searchAutocompleteArticles"></div><div class="searchAutocompleteSearch"></div></div>
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
    document.getElementById('search').addEventListener('input', autocompleteArticle)
    // TODO attach functions
    document.body.removeAttribute('aria-busy')
  }

  // Parsing MD

  function createMDRule (regex, tags = [{ tag: 'span', attribs: {} }], content = 1, filter) {
    // /(?<=>).*?(?=<)/

    // /(?<=>)[^<>]*(?=<)/

    // (?<=>)[^<>]*(?=<)(?!<\/code)

    return str => {
      if (filter) str = str.replace(new RegExp(filter, 'gms'), '')
      const matches = []
      do {
        const match = new RegExp(regex, 'gms').exec(str)
        if (!match) break
        matches.unshift(match)
      } while (true)

      return matches.forEach(m => {
        const els = tags.map(o => {
          const el = document.createElement(o.tag)
          Object.keys(o.attribs).forEach(key =>
            el.setAttribute(key, o.attribs[key] === 'number' ? m[o.attribs[key]] : o.attribs[key]))
          return el
        })
        if (content) els.push(document.createTextNode(m[content]))
        const el = els.reduceRight((acc, cur) => {
          cur.appendChild(acc)
          return cur
        })

        str = str.slice(0, m.index) + el.outerHTML + str.slice(m.index + m[0].length)
      })
    }
  }

  function getMDInfo () {
    return [
      // Code
      createMDRule('^```(.*?)^(.*?)```', [{ tag: 'pre', attribs: {} }, { tag: 'code', attribs: { settings: 1 } }], 2),
      createMDRule('``([^\n\r]*?)``', [{ tag: 'code', attribs: {} }], 1),
      createMDRule('`([^\n\r]*?)`', [{ tag: 'code', attribs: {} }], 1),
      createMDRule('((?:^(?:\t|    )[^\n\r]*$(?:\n|\r|\r\n))+)', [{ tag: 'pre', attribs: {} }, { tag: 'code', attribs: {} }], 1, '(^\t)'),

      // Blockquote
      createMDRule('^> ([^\n\r]*)', [{ tag: 'blockquote', attribs: {} }], 1),

      // Headings
      createMDRule('^###### ([^\r\n]*?)(?: #*)?$', [{ tag: 'h6', attribs: {} }], 1),
      createMDRule('^##### ([^\r\n]*?)(?: #*)?$', [{ tag: 'h5', attribs: {} }], 1),
      createMDRule('^#### ([^\r\n]*?)(?: #*)?$', [{ tag: 'h4', attribs: {} }], 1),
      createMDRule('^### ([^\r\n]*?)(?: #*)?$', [{ tag: 'h3', attribs: {} }], 1),
      createMDRule('^## ([^\r\n]*?)(?: #*)?$', [{ tag: 'h2', attribs: {} }], 1),
      createMDRule('^# ([^\r\n]*?)(?: #*)?$', [{ tag: 'h1', attribs: {} }], 1),
      createMDRule('^([^\r\n]*)$(?:\r|\n|\r\n)^=+', [{ tag: 'h1', attribs: {} }], 1),
      createMDRule('^([^\r\n]*)$(?:\r|\n|\r\n)^-+', [{ tag: 'h2', attribs: {} }], 1),

      // Unordered List
      createMDRule('(^ {1,3}(?:-|\+|\*)(?: |\t)+?.*?\n{3})', [{ tag: 'ul', attribs: {} }], 1, [{ regex: '^ {1,3}(?:-|\+|\*)(?: |\t)+?', string: '<li>' }, { regex: '$', string: '</li>' }]) // eslint-disable-line no-useless-escape
    ]
  }

  function parseMD (content) {
    // TODO
    return content
  }
})()
