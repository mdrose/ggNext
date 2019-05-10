'use strict'
const process = require('process')
const MongoClient = require('mongodb').MongoClient

function InvalidChannelError(message) {
  this.message = message
  this.stack = (new Error()).stack
}
InvalidChannelError.prototype = Object.create(Error.prototype)
InvalidChannelError.prototype.name = 'InvalidChannelError'

function createDB() {
  let db

  function getDatabase() { return db }

  function getChannelDocument(channel) {
    return new Promise((resolve, reject) => {
      db.collection('channels').findOne({_id: channel})
        .then((doc) => {
          if (doc === null) {
            const error = new InvalidChannelError()
            reject(error)
          } else {
            resolve(doc)
          }
        })
        .catch((err) => {
          console.error(`Encountered an error when searching for channel ${channel}`)
          console.error(err)
          reject(err)
        })
    })
  }

  function deleteUserFromQueue(userName, channel) {
    return new Promise((resolve, reject) => {
      db.collection('channels').updateOne({_id: channel}, {$pull: {queue: {name: userName}}})
        .then((result) => {
          if (result.modifiedCount === 1) {
            console.log(`Successfully removed ${userName} from the queue for channel ${channel}`)
            resolve(result)
          } else if (result.modifiedCount === 0) {
            console.error(`Could not remove ${userName} from the queue for channel ${channel}`)
            console.error(`Either queue for ${channel} does not exist or ${userName} is not queued for it`)
            reject('notFound')
          } else {
            console.error(`Encountered an error when removing ${userName} from the queue for channel ${channel}`)
            console.error('Received non-binary modifiedCount on an updateOne call.')
            reject('dbError')
          }
        })
        .catch((err) => {
          console.error(`Encountered an error when removing ${userName} from the queue for channel ${channel}`)
          console.error(err)
          reject(err)
        })
    })
  }

  function addUserToQueue(user, channel) {
    return new Promise((resolve, reject) => {
      db.collection('channels').updateOne({_id: channel}, {$push: {queue: user}})
        .then((result) => {
          console.log(`Successfully added ${user.name} to the queue for channel ${channel}`)
          resolve(result)
        })
        .catch((err) => {
          console.error("Encountered an error when updating a channel queue!")
          console.log(err)
          reject(err)
        })
    })
  }

  function createNewChannel(channel, queue) {
    return new Promise((resolve, reject) => {
      db.collection('channels').insertOne({_id: channel, queue: queue})
        .then((result) => {
          resolve(result)
        })
        .catch((err) => {
          console.error(`Encountered an error when attemmpting to add new channel ${channel}`)
          reject(err)
        })
    })
  }

  function getAPIKey(key) {
    return new Promise((resolve, reject) => {
      db.collection('apiKeys').findOne({_id: key})
        .then((result) => {
          resolve(result)
        })
        .catch((err) => {
          console.error(`Encountered an error when searching for API Key ${key}`)
          console.error(err)
          reject(err)
        })
    })
  }

  function dbConnect() {
    const MAX_CONNECTION_ATTEMPTS = 10
    let connectionAttempts = 0

    const client = new MongoClient(process.env.GGNEXT_MONGODB_URI)
    return new Promise((resolve, reject) => {
      function connectionAttempt() {
        client.connect(function (err) {
          if (err !== null) {
            if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
              console.error(err)
              connectionAttempts++
              // do we need to deref this?
              setTimeout(connectionAttempt, 3000)
            } else {
              reject(err)
            }
          } else {
            console.log("Connected successfully to database")
            ;['SIGINT', 'exit'].forEach((eventType) => {
              process.on(eventType, () => {
                console.log('Got ' + val + ' signal')
                console.log('Closing database connection..')
                client.close()
                // does this mask a proper exit from the program?
              })
            })
            db = client.db(process.env.GGNEXT_MONGODB_DBNAME)
            resolve()
          }
        })
      }
      connectionAttempt()
    })
  }

  return Object.freeze({
    getChannelDocument,
    deleteUserFromQueue,
    addUserToQueue,
    createNewChannel,
    getAPIKey,
    dbConnect,
    getDatabase
  })
}

module.exports.db = createDB()
module.exports.InvalidChannelError = InvalidChannelError
