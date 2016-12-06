const readline = require('readline')

const sequences = {
  star: ['-', '\\', '|', '/', '-', '\\', '|', '/'],
  block: [
    '▉',
    '▊',
    '▋',
    '▌',
    '▍',
    '▎',
    '▏',
    '▎',
    '▍',
    '▌',
    '▋',
    '▊',
    '▉'
  ]
}

const charSequence = sequences.star

let charIndex = 0

module.exports = {
  clearLine: clearLine,
  moveCursor: moveCursor,
  printOne: printOne
}

function printOne (opts) {
  if (opts.moveCursor) {
    moveCursor()
  }
  process.stdout.write(charSequence[charIndex])
  advance()
}

function advance () {
  charIndex = (
    charIndex < charSequence.length - 1 ? charIndex + 1 : 0
  )
}

function moveCursor () {
  readline.moveCursor(process.stdout, -1, 0)
}

function clearLine() {
  moveCursor()
  readline.clearLine(process.stdout, 0)
}
