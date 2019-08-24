'use strict'
const process = require('process')
const child_process = require('child_process')
const path = require('path')

const GGNEXT_ENV = process.argv[2]
if (GGNEXT_ENV !== 'dev' && GGNEXT_ENV !== 'test') {
  console.error('Usage: start_dev_env <type>')
  console.error('Type must be either "dev" or "test"\n')
  process.exit(1)
}

function launchContainers(superuser=false) {
  const processOptions = Object.freeze({
    cwd: path.dirname(__filename),
    env: {
      GGNEXT_ENV
    }
  })
  const command = (() => {
    let command = 'docker-compose up --build --abort-on-container-exit'
    return superuser ? 'sudo -E ' + command : command
  })()

  const dockerProcess = child_process.exec(command, processOptions, (error) => {
    if (error !== null && error.code === 1 && !superuser) {
      console.error('docker-compose gave the above error. Do you have permission to use Docker?')
      console.log('Attempting to rerun with sudo')
      launchContainers(true)
    }
  })

  dockerProcess.stdout.on('data', (chunk) => console.log(chunk))
  dockerProcess.stderr.on('data', (chunk) => console.log(chunk))

  return dockerProcess
}

const docker = launchContainers()

process.on('SIGINT', () => {
  docker.kill('SIGINT')
  process.exitCode = 0
})
