'use strict'
const fs = require('fs')
const crypto = require('crypto')
const process = require('process')
const querystring = require('querystring')
const express = require('express')
const session = require('express-session')
const got = require('got')
const jwt = require('jsonwebtoken')
const jwksClient = require('jwks-rsa')
const MongoDBStore = require('connect-mongodb-session')(session)
const path = require('path')

const { db } = require('./dbhelper')
const { validateFriendCode } = require('./validation')
const { loginRedirect, checkValidAuth, twitchAuth, checkValidKey } = require('./auth')
const sse = require('./sse')

const app = express()
const port = process.env.PORT || 80
const sessionSecret = process.env.GGNEXT_SESSION_SECRET

const store = new MongoDBStore({
  uri: process.env.GGNEXT_MONGODB_URI,
  collection: 'sessions'
})
store.on('error', function(error) {
  console.log(error);
})

const sessionOptions = {
  resave: true,
  saveUninitialized: true,
  secret: sessionSecret || crypto.randomBytes(128).toString(),
  store: store
}
app.use(session(sessionOptions))

const keyClient = jwksClient({
  jwksUri: twitchAuth.jwks_uri,
  cache: true
})

app.get('/login', function (req, res) {
  // This needs to be removed after success and expire otherwise
  req.session.loginRequest = {
    nonce: crypto.randomBytes(128).toString('base64'),
    state: crypto.randomBytes(128).toString('base64') + ':' + req.query.ref,
    response_type: 'code'
  }

  const query = new URLSearchParams([
    ['client_id', twitchAuth.client_id],
    ['redirect_uri', twitchAuth.redirect_uri],
    ['response_type', twitchAuth.response_type],
    ['scope', twitchAuth.scope],
    ['nonce', req.session.loginRequest.nonce],
    ['state', req.session.loginRequest.state]
  ])
  const authUrl = twitchAuth.authorization_endpoint + '?' + query.toString()
  res.redirect(authUrl)
})

app.get('/authorization', function (req, res) {
  const { state, response_type, nonce } = req.session.loginRequest
  const query = new URLSearchParams([
    ['client_id', twitchAuth.client_id],
    ['client_secret', twitchAuth.client_secret],
    ['code', req.query.code],
    ['grant_type', 'authorization_code'],
    ['redirect_uri', twitchAuth.redirect_uri]
  ])
  got(twitchAuth.token_endpoint, {query: query.toString(), method: 'post'})
    .then((resp) => {
      const idToken = JSON.parse(resp.body).id_token
      // REVIEW THIS
      function getKey(header, callback) {
        keyClient.getSigningKey(twitchAuth.jwks_kid, (err, key) => {
          if (err === null) {
            const signingKey = key.publicKey || key.rsaPublicKey
            callback(null, signingKey)
          } else {
            callback(null, null)
          }
        })
      }
      jwt.verify(idToken, getKey, {nonce: nonce}, (err, decoded) => {
        if (err === null) {
          req.session.userName = decoded.preferred_username.toLowerCase()
          // Prevents replay
          delete req.session.loginRequest
          // This needs to redirect back to the original page. URL should be stored in state
          // Grabs URL redirect component of state, which was separated by the :
          const redirectURL = decodeURIComponent(state.split(':')[1])
          res.redirect(redirectURL)
        } else {
          console.log(`Error encountered on token decoding: ${err}`)
          res.sendStatus(500)
        }
      })

    }, (err) => {
      console.log(`Error occured: ${err}`)
      res.sendStatus(500)
    })
})

function nightBotSetup(req, res, next) {
  // This should be enabled in production
  //const respURL = req.get('nightbot-response-url')
  //resp.location(respURL)

  req.channel = req.params.channel
  req.user = querystring.decode(req.get('nightbot-user'))
  if (typeof req.user === 'object') {
    req.user.friendCode = req.query.friendCode
    next()
  } else {
    res.sendStatus(400)
  }
}

app.get('/channel/:channel/challenge',
         nightBotSetup, checkValidKey, validateFriendCode, function (req, res) {

  const channel = req.channel
  const user = req.user

  db.getChannelDocument(channel)
    .then((doc) => {
      let queue = doc.queue
      let alreadyQueued = false
      for (let each of queue) {
        if (user.name === each.name) {
          alreadyQueued = true
          console.log(`${user.name} is already queued up for channel ${channel}`)
          res.send(`${user.name}: you're already queued up`)
          return
        }
      }
      if (!alreadyQueued) {
        const queuePosition = queue.length + 1
        db.addUserToQueue(user, channel).then((value) => {
          res.send(`${user.name}: you've been added to queue position #${queuePosition}`)
          sse.publishData(JSON.stringify(user), channel, 'newChallenger')
        }, (err) => {
          res.sendStatus(500)
        })
      }
    })
    .catch((err) => {
      if (err.name === 'InvalidChannelError') {
        console.log(`Channel: ${channel} not found. Creating a new entry`)
        db.createNewChannel(channel, [user]).then((value) => {
          res.send(`${user.name}: you've been added to queue position #1`)
        }, (err) => {
          res.sendStatus(500)
        })
      } else {
        console.error(err)
        res.sendStatus(500)
      }
    })
})

app.get('/channel/:channel/myPosition', nightBotSetup, checkValidKey, function(req, res, next) {
  const channel = req.channel
  const user = req.user

  db.getChannelDocument(channel)
    .then((doc) => {
      for (let [index, entry] of doc.queue.entries()) {
        if (user.name === entry.name) {
          res.send(`${user.name}: you're currently in queue position #${index+1}`)
          return
        }
      }
      res.send(`${user.name}: you're not currently queued up`)
    })
    .catch((err) => {
      res.sendStatus(500)
    })
})

app.use(loginRedirect)
app.use('/channel/:channel/', checkValidAuth)

app.get('/', function (req, res) {
  if (req.session.userName != null) {
    res.redirect(`/channel/${req.session.userName}/queue/view`)
  }
})

app.get('/channel/:channel/queue', function (req, res) {
  const channel = req.params.channel
  db.getChannelDocument(channel)
    .then((doc) => {
      const newConn = sse.createSSEConn(res, channel)
      newConn.sendData(JSON.stringify(doc.queue), 'fullQueue')
    })
    .catch((err) => {
      if (err.name === 'InvalidChannelError') {
        const newConn = sse.createSSEConn(res, channel)
        newConn.sendData([], 'fullQueue')
      }
      else res.sendStatus(500)
    })
})

app.delete('/channel/:channel/queue/:userName', function (req, res) {
  const channel = req.params.channel
  const userName = req.params.userName

  db.deleteUserFromQueue(userName, channel)
    .then((result) => res.sendStatus(200))
    .catch((err) => {
      if (err === 'notFound') res.sendStatus(404)
      else res.sendStatus(500)
    })
})

app.use('/channel/:channel/queue/view', express.static(path.join(__dirname, 'client')))
app.get('/channel/:channel/queue/view', (req, res) => {
  res.sendFile('main.html', {root: path.join(__dirname, 'client')})
})


if (require.main === module) {
  db.dbConnect()
    .then(() => {
      app.listen(port, () => console.log(`ggNext listening on port ${port}!`))
    })
    .catch((err) => {
      console.error(err)
      process.exit(1)
    })
}

module.exports = app
