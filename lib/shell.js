const exec = require('child_process').exec

module.exports = {
  execute: execute
}

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
