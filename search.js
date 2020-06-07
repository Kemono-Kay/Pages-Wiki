/* eslint-env worker */

onmessage = function (e) {
  const search = e.data[0]
  const pages = e.data[1]
  // pages.map(p => [p, levenshtein(p, search)])
}

/* function levenshtein (a, b) {

} */
