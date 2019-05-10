'use strict'
const process = require('process')
const { db } = require('./dbhelper')

function loginRedirect(req, res, next) {
  if (req.session.userName === undefined) {
    res.redirect('/login?ref=' + encodeURIComponent(req.originalUrl))
  } else {
    next()
  }
}

function checkValidAuth(req, res, next) {
  const channel = req.params.channel
  if (req.session.userName !== channel) {
    res.sendStatus(401)
  } else {
    next()
  }
}

function checkValidKey(req, res, next) {
  const apiKey = req.query.apiKey
  console.log(`Received API Key: ${apiKey}`)
  db.getAPIKey(apiKey)
    .then((doc) => {
      if (doc === null || !doc.channels.includes(req.channel)) {
        console.error(`${apiKey} is invalid for channel ${req.channel}`)
        res.sendStatus(403)
        return
      } else {
        console.log(`User ${req.user.name} has requested to be added to the queue for channel ${req.channel}`)
        next()
      }
    })
    .catch((err) => {console.error(err); res.sendStatus(500)})
}

const twitchAuth = Object.freeze({
  authorization_endpoint: 'https://id.twitch.tv/oauth2/authorize',
  token_endpoint: 'https://id.twitch.tv/oauth2/token',
  client_id: process.env.GGNEXT_CLIENT_ID,
  client_secret: process.env.GGNEXT_CLIENT_SECRET,
  jwks_uri: 'https://id.twitch.tv/oauth2/keys',
  jwks_kid: '1',
  redirect_uri: process.env.GGNEXT_URL + 'authorization',
  response_type: 'code',
  scope: 'openid'
})

module.exports = {loginRedirect, checkValidAuth, twitchAuth, checkValidKey}
