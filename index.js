#!/usr/bin/env node

const exec = require('child_process').exec
const spawn = require('child_process').spawn

const chalk = require('chalk')
const minimist = require('minimist')

const lastPrintedPod = {}
const pods = {}
const abandonedPodNames = []
const statusColors = {
  Completed: chalk.green,
  ContainerCreating: chalk.cyan,
  Error: chalk.red,
  Pending: chalk.yellow,
  Running: chalk.green,
  Succeeded: chalk.green,
  Terminating: chalk.yellow
}

let args
let searchStr

function execute (command) {
  return new Promise((resolve, reject) => {
    exec(
      command,
      (error, stdout, stderr) => {
        if (error) {
          reject(error)
        } else {
          resolve({
            stdout: stdout,
            stderr: stderr,
            combined: (stdout || '') + (stderr || '')
          })
        }
      }
    )
  })
}

function kubectl (command) {
  let fullCommand = `kubectl ${command}`
  if (args.namespace) {
    fullCommand += ` --namespace ${args.namespace}`
  }

  return execute(fullCommand)
}

function run () {
  args = minimist(process.argv.slice(2))

  if (args._.length !== 1) {
    console.log('Usage: npm run tail [--namespace name] <pod search pattern>')
    return
  }

  searchStr = args._[0]
  console.log(`Searching for pods matching ${chalk.bold(searchStr)}`)

  function update () {
    kubectl('get pods --show-all')
      .then(processOutput)
      .catch(error => {
        console.error(error)
        process.exit(1)
      })
  }

  function processOutput (out) {
    const foundPodNames = []
    out.combined
      .split('\n')
      .slice(1)
      .forEach(line => {
        const pod = getPodFromLine(line)
        if (!pod) {
          return
        }

        if (pod.name.indexOf(searchStr) === -1) {
          return
        }

        foundPodNames.push(pod.name)

        handlePod(pod)
      })

    if (!foundPodNames.length) {
      console.log(`No pods found yet`)
      return
    }

    // Handle pods that disappeared while we were sleeping.
    // NOTE: I think this is obsolete now that we're using --show-all
    Object.keys(pods).filter(podName => {
      return foundPodNames.indexOf(podName) === -1
    }).forEach(handleDisappearedPod)
  }

  update()
  setInterval(update, 10000)
}

/**
 * Get pod data from kubectl and parse resulting JSON.
 */
function getPodData (podName) {
  return new Promise((resolve, reject) => {
    kubectl(`get pod ${podName} -o json`)
      .then(out => {
        resolve(JSON.parse(out.stdout))
      })
      .catch(reject)
  })
}

/**
 * Parse a line from `kubectl get pods`.
 */
function getPodFromLine (line) {
  const parts = line.split(' ').filter(part => {
    return part.trim().length > 0
  })
  if (!parts.length) {
    return
  }
  if (parts.length !== 5) {
    return
  }

  const pod = {}
  pod.name = parts.shift()
  pod.readyRatio = parts.shift()
  pod.status = parts.shift()
  pod.restarts = parts.shift()
  pod.age = parts.shift()

  return pod
}

/**
 * Watch a pod that matches our search string.
 */
function handlePod (pod) {
  if (abandonedPodNames.indexOf(pod.name) !== -1) {
    return
  }

  const currentData = pods[pod.name]
  if (!currentData) {
    let colorFunc = statusColors[pod.status]
    if (!colorFunc) {
      console.error(`Unhandled status: ${pod.status}`)
      colorFunc = chalk.yellow
    }
    console.log(`Found pod ${chalk.cyan(pod.name)} with status ${colorFunc(pod.status)} and age ${pod.age}`)
    pods[pod.name] = {data: pod}
  } else {
    const oldStatus = currentData.data.status
    if (oldStatus !== pod.status) {
      const oldStatusColorFunc = statusColors[oldStatus] || chalk.yellow
      const newStatusColorFunc = statusColors[pod.status] || chalk.yellow
      console.log(`${chalk.cyan(pod.name)} transitioned status: ${oldStatusColorFunc(oldStatus)} -> ${newStatusColorFunc(pod.status)}`)

      if (pod.status === 'Terminating' || pod.status === 'Completed') {
        cleanupPod(pod.name)
        return
      }
    }

    pods[pod.name].data = pod
  }

  if (pod.status === 'Running') {
    if (currentData && currentData.tailProc) {
      return
    }
    pods[pod.name].tailProc = spawnTail(pod.name)
  }
}

/**
 * Report a pod's status if it finished.
 */
function handleDisappearedPod (podName) {
  getPodData(podName)
    .then(podData => {
      const status = podData.status.phase
      const colorFunc = statusColors[status] || chalk.yellow
      console.log(`${podName} has stopped. Its status is ${colorFunc(status)}`)
      cleanupPod(podName)
    })
    .catch(err => {
      console.error(err)
      cleanupPod(podName)
    })
}

function cleanupPod (podName) {
  console.log(`- cleaning up after ${podName}`)
  const data = pods[podName]
  if (!data) {
    return
  }

  if (data.tailProc) {
    data.tailProc.kill()
  }

  delete pods[podName]

  abandonedPodNames.push(podName)
}

function spawnTail (podName) {
  console.log(`- starting tail of ${podName}`)

  const procArgs = ['logs', '--follow', '--tail=10', podName]
  if (args.namespace) {
    procArgs.unshift(`--namespace=${args.namespace}`)
  }
  const proc = spawn('kubectl', procArgs)

  proc.stdout.on('data', function (data) {
    data.toString().trim().split('\n').forEach(line => {
      if (lastPrintedPod.podName !== podName || lastPrintedPod.streamName !== 'stdout') {
        console.log(chalk.bold(`\n==> ${podName} stdout <==`))
        lastPrintedPod.podName = podName
        lastPrintedPod.streamName = 'stdout'
      }
      console.log(line)
    })
  })

  proc.stderr.on('data', function (data) {
    data.toString().trim().split('\n').forEach(line => {
      if (lastPrintedPod.podName !== podName || lastPrintedPod.streamName !== 'stderr') {
        console.log(chalk.red(`\n==> ${podName} stderr <==`))
        lastPrintedPod.podName = podName
        lastPrintedPod.streamName = 'stderr'
      }
      console.log(line)
    })
  })

  proc.on('error', error => {
    console.error(error)
  })

  return proc
}

if (require.main === module) {
  run()
}
