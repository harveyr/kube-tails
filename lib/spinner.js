const readline = require('readline')
const chalk = require('chalk')

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
let lastLineSize = 0

module.exports = {
  clearLine: clearLine,
  moveCursor: moveCursor,
  printOne: printOne
}

function printOne (opts) {
  if (opts.moveCursor) {
    moveCursor()
  }

  let line = charSequence[charIndex]
  if (opts.description) {
    line += ` ${opts.description}`
  }

  lastLineSize = line.length

  process.stdout.write(chalk.dim(line))
  advance()
}

function advance () {
  charIndex = (
    charIndex < charSequence.length - 1 ? charIndex + 1 : 0
  )
}

function moveCursor () {
  readline.moveCursor(process.stdout, -1 * lastLineSize, 0)
}

function clearLine () {
  moveCursor()
  readline.clearLine(process.stdout, 0)
}
