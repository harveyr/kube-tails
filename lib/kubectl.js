const execute = require('./shell.js').execute
const spawn = require('child_process').spawn

let context
let namespace

module.exports = {
  exec: execKubectl,
  spawn: spawnKubectl
}

function execKubectl (command) {
  let contextPart = context ? `--context=${context}` : ''
  let namespacePart = namespace ? `--namespace=${namespace}` : ''

  let fullCommand = `kubectl ${contextPart}${namespacePart}${command}`

  return execute(fullCommand)
}

function spawnKubectl (args) {
  if (namespace) {
    args.unshift(`--namespace=${namespace}`)
  }
  if (context) {
    args.unshift(`--context=${context}`)
  }

  return spawn('kubectl', args)
}
