/* eslint-env browser */

var oReq = new XMLHttpRequest()
oReq.addEventListener('load', (...args) => console.log(args))
oReq.open('GET', 'data/config.json')
oReq.send()
