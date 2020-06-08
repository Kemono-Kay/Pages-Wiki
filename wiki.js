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

    if (!config.era) { config.era = 'BC' }
    config.era = ['bc', 'ad'].includes(config.era.toLowerCase()) ? { '-': 'BC', '+': 'AD' } : { '-': 'BCE', '+': 'CE' }

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
    return xhr(`./data/${config.pages[params.title]}`, loadArticlePage)
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

    var observer = new MutationObserver(function (m) {
      m.forEach(function (m) {
        observer.disconnect()
        const emptyEls = [].slice.call(document.getElementsByTagName('p'))
        for (const p of emptyEls) { if (p.childNodes.length === 0) p.remove() }
      })
      // observer.disconnect()
      /* for (const p of document.getElementsByTagName('p')) { if (p.childNodes.length === 0) p.remove() }
      document.getElementById('search').addEventListener('input', autocompleteArticle)
      // TODO attach functions
      document.body.removeAttribute('aria-busy') */
    })

    observer.observe(document.body, { childList: true, subtree: true })
    document.body.innerHTML = getPageHTML(article, footer, nav)
  }

  // Parsing MD

  function createMDRule (regex, tags = [{ tag: 'span', attribs: {} }], content = 1, postProcessing = (str) => str) {
    // /(?<=>).*?(?=<)/

    // /(?<=>)[^<>]*(?=<)/

    // (?<=>)[^<>]*(?=<)(?!<\/code)

    return str => {
      /* if (filter) {
        filter = [filter].flat()
        filter.forEach(f => {
          if (typeof f === 'string') {
            str = str.replace(new RegExp(f, 'gms'), '')
          } else {
            str = str.replace(new RegExp(f.regex, 'gms'), f.string)
          }
        })
      } */
      const matches = []
      const r = new RegExp(regex, 'gms')
      do {
        const match = r.exec(str)
        if (!match) break
        matches.unshift(match)
      } while (true)

      matches.forEach(m => {
        const els = tags.map(o => {
          const el = document.createElement(o.tag)
          Object.keys(o.attribs).forEach(key =>
            el.setAttribute(key, typeof o.attribs[key] === 'number'
              ? m[o.attribs[key]]
              : typeof o.attribs[key] === 'function'
                ? o.attribs[key](m)
                : o.attribs[key]))
          return el
        })
        if (content !== false) els.push(deobfuscate(typeof content === 'function' ? content(m) : m[content]))
        const el = els.reduceRight((acc, cur) => {
          if (typeof acc === 'string') {
            cur.innerHTML = `\n${acc}\n`
          } else {
            cur.appendChild(acc)
          }
          return cur
        })

        str = str.slice(0, m.index) + obfuscate(postProcessing(el.outerHTML), false, false) + str.slice(m.index + m[0].length)
      })

      return str
    }
  }

  function getMDInfo () {
    return [

      // At-directives
      createMDRule('@year-range +(?:([0-9]+)([Aa][Dd]|[Cc][Ee]|[Bb][Cc][Ee]?|)|([Nn][Oo][Ww])) +(?:([0-9]+)([Aa][Dd]|[Cc][Ee]|[Bb][Cc][Ee]?|)|([Nn][Oo][Ww]))', [{ tag: 'span', attribs: {} }], m => {
        const date1 = Number(m[3] ? new Date().getFullYear() : m[1])
        const date2 = Number(m[6] ? new Date().getFullYear() : m[4])
        var ce2 = !m[5] || !['bce', 'bc'].includes(m[5].toLowerCase())
        var ce1 = !m[2] || m[2] ? !['bce', 'bc'].includes(m[2].toLowerCase()) : ce2
        m[2] = m[3] || m[2]
        m[6] = m[5] || m[6]
        console.log(date1, date2, ce1, ce2)
        if (isNaN(date1) || isNaN(date2)) return new Date().getFullYear()
        if (date1 === date2 && ce1 === ce2) return `${date1} ${!ce1 ? config.era['-'] : ''}`
        if (!ce1 && !ce2 && date1 > date2) return `${date1} - ${date2} ${config.era['-']}`
        if (!ce1 && !ce2 && date1 < date2) return `${date2} - ${date1} ${config.era['-']}`
        if (ce1 && ce2 && date1 < date2) return `${date1} - ${date2}`
        if (ce1 && ce2 && m[2] && date1 > date2) return `${date2} - ${date1}`
        if (ce1 && ce2 && !m[2] && date1 > date2) return `${date1} ${config.era['-']} - ${date1} ${config.era['+']}`
        if (!ce1 && ce2) return `${date1} ${config.era['-']} - ${date2} ${config.era['+']}`
        if (ce1 && !ce2 && m[6]) return `${date2} ${config.era['-']} - ${date1} ${config.era['+']}`
        if (ce1 && !ce2 && !m[6]) return `${date1} - ${date2} ${config.era['+']}`
      }),
      createMDRule('^[ \t]*@category((?:[ \t]+[A-Za-z0-9_-]+)+)[ \t]*$', [{ tag: 'input', attribs: { type: 'hidden', name: m => 'category', value: m => m[1].trim() } }], false),
      createMDRule('^[ \t]*@table-of-contents[ \t]*$', [{ tag: 'div', attribs: { class: 'toc' } }], false),

      // Reference
      createMDRule(' {0,3}\\[([^\\]]+)\\]:[ \\t]+(?:<([^>]+)>|([^\\s]+))(?:[ \\t]*(?:\\r|\\n|\\r\\n)?[ \\t]*(?:\\(([^)]+)\\)|\'([^\']+)\'|"([^"]+)"))?[^\\r\\n]*?$', [{ tag: 'input', attribs: { type: 'hidden', name: m => `reflink-${m[1].toLowerCase()}`, value: m => m[2] || m[3], 'data-title': m => m[4] || m[5] || m[6] || '' } }], false),

      // List
      // TODO: may be worth just running it multiple times instead of this shenanigan. With something like this: ^( {0,3}).*?^(?=\1)(?!\1 )
      createMDRule('(^ {0,3}(?:-|\\+|\\*)(?: |\\t)+?[^\\r\\n]*(?:(?:\\r|\\n|\\r\\n){1,2}^ {0,3}(?:-|\\+|\\*)(?: |\\t)+?[^\\r\\n]*|(?:\\r|\\n|\\r\\n){2}(?:\\t| {4}[^\\r\\n]*)|(?:\\r|\\n|\\r\\n)[^\\r\\n]+|)*)', [{ tag: 'ul', attribs: {} }], 0, str => {
        str = str.split('\n').filter(li => li)
        str = str.slice(1, str.length - 1)
        const indent = []
        str.forEach((str, i) => {
          var match = str.match(/^( *)(?:\*|\+|-)/)
          if (!match) {
            indent.push({ str, indent: i ? indent[i - 1].indent : 0 })
          } else {
            indent.push({ str, indent: match[1].length })
          }
        })
        var blocks = []
        str = indent.map((v, i, a) => {
          v.str = v.str.replace(/ *(?:\*|\+|-) */gsm, '')

          if (i + 1 !== a.length && a[i + 1].indent > v.indent) {
            blocks.unshift(a[i + 1].indent)
            return `<li>${v.str}<ul>`
          } else {
            v.str = `<li>${v.str}</li>`
            if (i + 1 !== a.length && a[i + 1].indent < v.indent) {
              while (blocks[0] > a[i + 1].indent) {
                blocks.shift()
                v.str += '</ul></li>'
              }
            } else if (i + 1 === a.length) {
              while (blocks.length) {
                blocks.shift()
                v.str += '</ul></li>'
              }
            }
            return v.str
          }
        })
        return `<ul>${str.join('\n')}</ul>`
      }),
      createMDRule('(^ {0,3}[0-9]*\\.(?: |\\t)+?[^\\r\\n]*(?:(?:\\r|\\n|\\r\\n){1,2}^ {0,3}[0-9]*\\.(?: |\\t)+?[^\\r\\n]*|(?:\\r|\\n|\\r\\n){2}(?:\\t| {4}[^\\r\\n]*)|(?:\\r|\\n|\\r\\n)[^\\r\\n]+|)*)', [{ tag: 'ol', attribs: {} }], 0, str => {
        str = str.split('\n').filter(li => li)
        str = str.slice(1, str.length - 1)
        const indent = []
        str.forEach((str, i) => {
          var match = str.match(/^( *)(?:[0-9]+\.)/)
          if (!match) {
            indent.push({ str, indent: i ? indent[i - 1].indent : 0 })
          } else {
            indent.push({ str, indent: match[1].length })
          }
        })
        var blocks = []
        str = indent.map((v, i, a) => {
          v.str = v.str.replace(/ *(?:[0-9]+\.) */gsm, '')

          if (i + 1 !== a.length && a[i + 1].indent > v.indent) {
            blocks.unshift(a[i + 1].indent)
            return `<li>${v.str}<ol>`
          } else {
            v.str = `<li>${v.str}</li>`
            if (i + 1 !== a.length && a[i + 1].indent < v.indent) {
              while (blocks[0] > a[i + 1].indent) {
                blocks.shift()
                v.str += '</ol></li>'
              }
            } else if (i + 1 === a.length) {
              while (blocks.length) {
                blocks.shift()
                v.str += '</ol></li>'
              }
            }
            return v.str
          }
        })
        return `<ol>${str.join('\n')}</ol>`
      }),

      // Code
      createMDRule('^```(.*?)^(.*?)```', [{ tag: 'pre', attribs: {} }, { tag: 'code', attribs: { 'data-settings': 1 } }], 2),
      createMDRule('``([^\\n\\r]*?)``', [{ tag: 'code', attribs: {} }], 1),
      createMDRule('`([^\\n\\r]*?)`', [{ tag: 'code', attribs: {} }], 1),
      createMDRule('((?:^(?:\\t|    )[^\\n\\r]*$(?:\\n|\\r|\\r\\n))+)', [{ tag: 'pre', attribs: {} }, { tag: 'code', attribs: {} }], 1/*, ',(^\\t)' */, str => str.replace(/^\t/gms, '')),

      // Blockquote
      createMDRule('^> ([^\\n\\r]*)', [{ tag: 'blockquote', attribs: {} }], 1),

      // Headings
      createMDRule('^###### ([^\\r\\n]*?)(?: #*)?$', [{ tag: 'h6', attribs: {} }], 1),
      createMDRule('^##### ([^\\r\\n]*?)(?: #*)?$', [{ tag: 'h5', attribs: {} }], 1),
      createMDRule('^#### ([^\\r\\n]*?)(?: #*)?$', [{ tag: 'h4', attribs: {} }], 1),
      createMDRule('^### ([^\\r\\n]*?)(?: #*)?$', [{ tag: 'h3', attribs: {} }], 1),
      createMDRule('^## ([^\\r\\n]*?)(?: #*)?$', [{ tag: 'h2', attribs: {} }], 1),
      createMDRule('^# ([^\\r\\n]*?)(?: #*)?$', [{ tag: 'h1', attribs: {} }], 1),
      createMDRule('^([^\\r\\n]*)$(?:\\r|\\n|\\r\\n)^=+', [{ tag: 'h1', attribs: {} }], 1),
      createMDRule('^([^\\r\\n]*)$(?:\\r|\\n|\\r\\n)^-+', [{ tag: 'h2', attribs: {} }], 1),

      // Horizontal Rule
      createMDRule('^([ _*-]*[_*-][ _*-]*[_*-][ _*-]*[_*-][ _*-]*)$', [{ tag: 'hr', attribs: {} }], false),

      // Wikilinks
      createMDRule('\\[\\[([a-zA-Z0-9_-]+?)\\]\\]', [{
        tag: 'a',
        attribs: {
          href: m => `?title=${m[1]}`,
          title: m => m[1].replace('_', ' ')
        }
      }],
      m => {
        const s = m[1].split(':')
        return s[s.length - 1].replace('_', ' ')
      }),
      createMDRule('\\[([^\\]]+?)\\]\\(\\[([a-zA-Z0-9_-]+?)\\]\\)', [{
        tag: 'a',
        attribs: {
          href: m => `?title=${m[2]}`,
          title: m => m[2].replace('_', ' ')
        }
      }],
      1),

      // Images
      createMDRule('!\\[([^\\]]*)\\]\\(([^\\s]+)\\)(?=\\s|$)', [{ tag: 'img', attribs: { src: 2, alt: 1, title: 1 } }], false),
      createMDRule('!\\[([^\\]]+)\\] ?\\[([^\\]]+)\\]', [{ tag: 'img', attribs: { class: 'reflink', 'data-reflink': m => m[2] } }], 1),
      createMDRule('!\\[([^\\]]+)\\] ?\\[\\]', [{ tag: 'img', attribs: { class: 'reflink', 'data-reflink': m => m[1] } }], 1),

      // Links
      createMDRule('\\[([^\\]]+)\\]\\(([^\\s]+)\\)(?=\\s|$)', [{ tag: 'a', attribs: { href: 2 } }], 1),
      createMDRule('\\[([^\\]]+)\\] ?\\[([^\\]]+)\\]', [{ tag: 'a', attribs: { class: 'reflink', 'data-reflink': m => m[2] } }], 1),
      createMDRule('\\[([^\\]]+)\\] ?\\[\\]', [{ tag: 'a', attribs: { class: 'reflink', 'data-reflink': m => m[1] } }], 1),

      // Emphasis
      createMDRule('\\*\\*(?! )([^\\r\\n]*?)(?<! )\\*\\*|__(?! )([^\\r\\n]*?)(?<! )__', [{ tag: 'strong', attribs: {} }], m => m[1] || m[2]),
      createMDRule('\\*(?! )([^\\r\\n]*?)(?<! )\\*|_(?! )([^\\r\\n]*?)(?<! )_', [{ tag: 'em', attribs: {} }], m => m[1] || m[2]),

      // Auto Links
      createMDRule('<([^ ]+@[^ ]+\\.[^ ]+)>(?=\\s|$)', [{ tag: 'a', attribs: { href: m => obfuscate(`mailto:${m[1]}`) } }], m => obfuscate(m, true)),
      createMDRule('<([^ ]*[#@.:/?&][^ ]*)>(?=\\s|$)', [{ tag: 'a', attribs: { href: 1 } }], 1),

      // Paragraphs
      createMDRule('^(?:\\r|\\n|\\r\\n)(^[^\\r\\n]+$)(?:\\r|\\n|\\r\\n)$', [{ tag: 'p', attribs: {} }], 1)

    ]
  }

  function obfuscate (str, spaces = false, random = true) {
    return str.split('').map(char => {
      var str = spaces && Math.random() > 0.7 ? Math.random() > 0.5 ? '&#xfeff;' : '&#65279;' : ''
      if (Math.random() > 0.5 || !random) {
        str += `&#${char.codePointAt(0).toString(10)};`
      } else {
        str += `&#x${char.codePointAt(0).toString(16)};`
      }
      return str
    }).join('')
  }

  function deobfuscate (str) {
    return str.replace(/&#([0-9]*);/gms, (_, m) => String.fromCodePoint(m))
  }

  function parseMD (content) {
    // TODO markdown post-processing
    content = MD.reduce((str, rule) => rule(str), `\n${content}\n`
      .split(/(?:\r\n|\r|\n)/)
      .map(str => str.trim().length ? str : '')
      .join('\n')
      .replace(/\\[\\`*_{}[\]()#+-.!@]/gms, m => `&#${m.codePointAt(1)};`))
    // .replace(/(?<![\r\n])(?:\r|\n|\r\n)(?![\r\n])/gms, ' ')
    return deobfuscate(content).replace(/<p><\/p>/g, '')
  }
})()
