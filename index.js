#!/usr/bin/env node

const minimist = require('minimist')
const configManager = require('./lib/configManager.js')
const podManager = require('./lib/podManager.js')

function run () {
  configManager.loadFromArgs(minimist(process.argv.slice(2)))
  podManager.start()
}

if (require.main === module) {
  run()
}
