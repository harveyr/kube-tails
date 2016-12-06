const chalk = require('chalk')

const kubectl = require('./kubectl.js')
const spinner = require('./spinner.js')
const config = require('./configManager.js').config

const statusColors = {
  Completed: chalk.green,
  ContainerCreating: chalk.cyan,
  Error: chalk.red,
  Pending: chalk.yellow,
  Running: chalk.green,
  Succeeded: chalk.green,
  Terminating: chalk.yellow
}

const abandonedPodNames = []
const lastPrintedPod = {}
const pods = {}

let lastMessageWasExcluded

module.exports = {
  start: start
}

function start () {
  console.log(`Fetching pods matching '${config.podSearchStr}'`)
  update()
  setInterval(update, 10000)
}

function update () {
  getMatchingPods().then(pods => {
    pods.forEach(handlePod)
  })
}

/**
 * Get pod data from kubectl and parse resulting JSON.
 */
function getPodData (podName) {
  return new Promise((resolve, reject) => {
    kubectl.exec(`get pod ${podName} -o json`)
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

function getMatchingPods () {
  return new Promise((resolve, reject) => {
    kubectl.exec('get pods --show-all')
      .then(output => {
        const pods = []
        output.combined
          .split('\n')
          .slice(1)
          .forEach(line => {
            const pod = getPodFromLine(line)
            if (!pod) {
              return
            }

            if (pod.name.indexOf(config.podSearchStr) === -1) {
              return
            }

            pods.push(pod)
          })

        resolve(pods)
      })
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
  })
}

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

function spawnTail (podName) {
  console.log(`- starting tail of ${podName}`)

  const proc = kubectl.spawn(['logs', '--follow', '--tail=10', podName])

  proc.stdout.on('data', function (data) {
    data.toString().trim().split('\n').forEach(line => {
      printLine(podName, 'stdout', line)
    })
  })

  proc.stderr.on('data', function (data) {
    data.toString().trim().split('\n').forEach(line => {
      printLine(podName, 'stderr', line)
    })
  })

  proc.on('error', error => {
    console.error(error)
  })

  return proc
}

function printLine (podName, streamName, line) {
  if (config.excludeRegexen.length) {
    const shouldExclude = config.excludeRegexen.some(regex => {
      return regex.test(line)
    })
    if (shouldExclude) {
      return printSpinner(podName)
    }
  }

  if (lastMessageWasExcluded) {
    spinner.clearLine()
  }

  if (lastPrintedPod.podName !== podName || lastPrintedPod.streamName !== streamName) {
    const headerFunc = streamName === 'stderr' ? chalk.red : chalk.bold
    headerFunc(`\n==> ${podName} ${streamName} <==`)
    lastPrintedPod.podName = podName
    lastPrintedPod.streamName = streamName
  }

  console.log(line)
  lastMessageWasExcluded = false
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

function printSpinner (podName) {
  spinner.printOne({
    description: `excluded line from ${podName}`,
    moveCursor: lastMessageWasExcluded
  })
  lastMessageWasExcluded = true
}
