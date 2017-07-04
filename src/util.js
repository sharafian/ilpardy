const fs = require('fs')
const path = require('path')

function shuffle (str) {
  const a = str.split(""),
    n = a.length;

  for(let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }

  return a
}

function load (file) {
  return fs.readFileSync(path.resolve(__dirname, file))
    .toString('utf8')
}

module.exports = {
  shuffle,
  load
}
