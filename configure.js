'use strict'
const readline = require('readline')
const process = require('process')
const fs = require('fs')
const path = require('path')

const type = process.argv[2]
if (type !== 'dev' && type !== 'prod') {
  console.error('Usage: configure <type>')
  console.error('Type must be either "dev" or "prod"\n')
  process.exit(1)
}

const textFriendlyEnv = Object.freeze({
  dev: 'development',
  prod: 'production'
})

const variableDefaults = Object.freeze({
  [`GGNEXT_${type.toUpperCase()}_MONGODB_DBNAME`]: 'ggnext',
  [`GGNEXT_${type.toUpperCase()}_MONGODB_URI`]: 'mongodb://mongo:27017/$GGNEXT_DEV_MONGODB_DBNAME',
  [`GGNEXT_${type.toUpperCase()}_URL`]: 'http://localhost:5000/',
})

const variableQuestions = ({
  [`GGNEXT_${type.toUpperCase()}_CLIENT_ID`]: `Enter your Twitch.tv ${textFriendlyEnv[type]} client id: `,
  [`GGNEXT_${type.toUpperCase()}_CLIENT_SECRET`]: `Enter your Twitch.tv ${textFriendlyEnv[type]} client secret: `
})

if (type === 'prod') {
  variableQuestions['GGNEXT_PROD_URL'] = `Enter your ${textFriendlyEnv[type]} web URL: `
  variableQuestions['GGNEXT_PROD_MONGODB_URI'] = `Enter your ${textFriendlyEnv[type]} MongoDB URI: `
  variableQuestions['GGNEXT_PROD_SESSION_SECRET'] = `Enter your ${textFriendlyEnv[type]} session secret: `
}
Object.freeze(variableQuestions)

function createQuestionnaire() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const questions = []

  function questionPromise(question) {
    return new Promise((resolve, reject) => {
      rl.question(question, (answer) => {
        resolve(answer)
      })
    })
  }

  function question(question) {
    questions.push(question)
  }

  async function ask() {
    const answers = {}
    for (const question of questions) {
      answers[question] = await questionPromise(question)
    }
    rl.close()

    return answers
  }

  return Object.freeze({
    question,
    ask,
    write: rl.write.bind(rl)
  })
}

const questionnaire = createQuestionnaire()

questionnaire.write(`To configure the ggNext ${textFriendlyEnv[type]} environment to use Twitch.tv authorization, ` +
                    'you need to enter a client id / secret registered with Twitch.tv\n\n')
Object.values(variableQuestions).forEach((question) => {
  questionnaire.question(question)
})

questionnaire.ask().then((result) => {
  const dataObject = {}
  Object.assign(dataObject, variableDefaults)
  for (const [variable, question] of Object.entries(variableQuestions)) {
    dataObject[variable] = result[question]
  }

  let data = ''
  for (const [variable, setting] of Object.entries(dataObject)) {
    data += `${variable}="${setting}"\n`
  }

  const outfile = path.join(path.dirname(__filename), `${type}.settings`)
  fs.writeFileSync(outfile, data)
})
