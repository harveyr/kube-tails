let config = {
  podSearchStr: '',
  excludeRegexen: []
}

module.exports = {
  config: config,
  loadFromArgs: loadFromArgs
  // createConfig: createConfig
}

function loadFromArgs (args) {
  if (args._.length !== 1) {
    console.log('Usage: npm run tail [--namespace name] <pod search pattern>')
    process.exit(1)
  }

  config.podSearchStr = args._[0]

  console.log(`Pod search string: ${config.podSearchStr}`)

  if (args.exclude) {
    if (typeof args.exclude === 'object') {
      args.exclude.forEach(excludeStr => {
        config.excludeRegexen.push(new RegExp(`.*${excludeStr}.*`))
      })
    } else {
      config.excludeRegexen.push(new RegExp(`.*${args.exclude}.*`))
    }

    console.log('Excluding:', config.excludeRegexen)
  }

  return config
}
