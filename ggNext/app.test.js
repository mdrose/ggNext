'use strict'
const querystring = require('querystring')
const process = require('process')
const request = require('supertest')
const assert = require('assert')
const http = require('http')

const auth = require('./auth')
auth.loginRedirect = auth.checkValidAuth = jest.fn((req, res, next) => next())

const crypto = require('crypto')

const app = require('./app')
const dbhelper = require('./dbhelper').db
const sse = require('./sse')

const testUser = {
    name: 'maintestuser',
    displayName: 'MAINTESTUSER',
    provider: 'twitch',
    providerId: '123456789',
    userLevel: 'owner'
}
const userQuery = querystring.stringify(testUser)

function generateUserData(name, displayName) {
  return (new URLSearchParams({
    name,
    displayName,
    provider: 'twitch',
    providerId: '123456789',
    userLevel: 'owner'
  })).toString()
}

let db
beforeAll(() => {
  return dbhelper.dbConnect()
    .then(() => new Promise((resolve) => resolve(db = dbhelper.getDatabase())))
    .then(() => db.collection('apiKeys').insertOne({_id: 'validKey', channels: ['validChannel', 'anotherValidChannel', 'invalidChannel']}))
})

function insertTestChannels() {
  return db.collection('channels').insertOne({_id: 'validChannel', queue: [{name: `${testUser.name}`}]})
           .then(() => db.collection('channels').insertOne({_id: 'anotherValidChannel', queue: [{name: 'someUser'}]}))
}

function clearTestChannels() {
  return db.collection('channels').deleteMany({})
}

describe('GET /channel/:channel/challenge', () => {
  const generateEndpoint = (channel) => '/channel/' + channel + '/challenge'

  beforeAll(() => {
    jest.spyOn(sse, 'publishData').mockImplementation(() => undefined)
    return insertTestChannels()
  })

  afterAll(() => {
    jest.restoreAllMocks()
    return clearTestChannels()
  })

  test('Invalid API Key', (done) => {
    request(app)
      .get(generateEndpoint('validChannel') + '?apiKey=invalidKey')
      .set('nightbot-user', userQuery)
      .expect(403, done)
  })

  test('Valid API Key for an unauthorized channel', (done) => {
    request(app)
      .get(generateEndpoint('wrongChannel') + '?apiKey=validKey')
      .set('nightbot-user', userQuery)
      .expect(403, done)
  })

  test.skip('Error with getAPIKey', (done) => {
    const getAPIKeyMock = jest.spyOn(dbhelper, 'getAPIKey').mockImplementation((apiKey) => {
      return new Promise((resolve, reject) => {reject()})
    })

    request(app)
      .get(generateEndpoint('validChannel') + '?apiKey=validKey')
      .set('nightbot-user', userQuery)
      .expect(500)
      .then(() => { getAPIKeyMock.mockReset(); done(); })
  })

  test('Already queued', (done) => {
    request(app)
      .get(generateEndpoint('validChannel') + '?apiKey=validKey&friendCode=1111-1111-1111')
      .set('nightbot-user', userQuery)
      .expect(200)
      .expect(`${testUser.name}: you\'re already queued up`, done)
  })

  test('Valid key. Valid channel. Not queued', (done) => {
     request(app)
      .get(generateEndpoint('anotherValidChannel') + '?apiKey=validKey&friendCode=0000-0000-0000')
      .set('nightbot-user', userQuery)
      .expect(200)
      .expect(`${testUser.name}: you've been added to queue position #2`, done)
  })

  test('Valid key. Non-existant channel', (done) => {
    request(app)
      .get(generateEndpoint('invalidChannel') + '?apiKey=validKey&friendCode=0000-0000-0000')
      .set('nightbot-user', userQuery)
      .expect(200)
      .expect(`${testUser.name}: you\'ve been added to queue position #1`, done)
  })

  test.skip('Valid key. Non-existant channel. createNewChannel error', (done) => {
    const getChannelDocumentMock = jest.spyOn(dbhelper, 'getChannelDocument')
                                   .mockImplementation(() =>
                                     (new Promise((resolve, reject) => {reject(new dbhelper.InvalidChannelError())})))
    const createNewChannelMock = jest.spyOn(dbhelper, 'createNewChannel')
                                 .mockImplementation(() => (new Promise((resolve, reject) => {reject()})))

    request(app)
      .get(generateEndpoint('validChannel') + '?apiKey=validKey&friendCode=0000-0000-0000')
      .set('nightbot-user', userQuery)
      .expect(500)
      .then(() => { getChannelDocumentMock.mockReset(); createNewChannelMock.mockReset(); done(); })
  })

})

describe('GET /channel/:channel/myPosition', () => {
  beforeAll(() => {
    return insertTestChannels()
  })

  afterAll(() => {
    return clearTestChannels()
  })

  test('In queue', (done) => {
    request(app)
      .get('/channel/validChannel/myPosition?apiKey=validKey')
      .set('nightbot-user', userQuery)
      .expect(`${testUser.name}: you\'re currently in queue position #1`)
      .expect(200, done)
  })

  test('Not in queue', (done) => {
    const userName = 'bob'
    request(app)
      .get('/channel/validChannel/myPosition?apiKey=validKey')
      .set('nightbot-user', generateUserData(userName))
      .expect(`${userName}: you're not currently queued up`)
      .expect(200, done)
  })
})

describe('GET /channel/:channel/queue', () => {
  const generateEndpoint = (channel) => '/channel/' + channel + '/queue'

  beforeAll(() => {
    return insertTestChannels()
  })

  afterAll(() => {
    return clearTestChannels()
  })

  function getFirstMessage(app, path) {
    function composeMessage(messageString) {
      const messageObject = {}
      const dataStream = messageString.split('\n')
                         .map((piece) => piece.split(/:(.+)/).slice(0,-1))
                         .map((piece) => piece.length > 1 ? [piece[0], piece[1].trim()] : piece)
      for (const item of dataStream) {
        if (item[0] === '') break

        if (messageObject[item[0]]) messageObject[item[0]] += item[1]
        else messageObject[item[0]] = item[1]
      }

      return messageObject
    }

    return new Promise((resolve, reject) => {
      const server = http.createServer(app)
      const address = '127.0.0.1'
      server.listen(0, address, function () {
        const options = {
          host: address,
          port: server.address().port,
          path,
          headers: {
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        }
        const req = http.request(options, (res) => {
          let receivedData = ''
          res.on('data', (chunk) => {
            if (chunk === '') return
            const messageBreak = chunk.toString().split('\n\n')

            if (chunk === '\n\n' || messageBreak[0] === '') {
              req.abort()
              resolve(composeMessage(receivedData))
            } else if (messageBreak[1] === undefined) {
              receivedData += messageBreak[0]
            } else {
              receivedData += messageBreak[0]
              req.abort()
              resolve(composeMessage(receivedData))
            }

          })
        })
        req.setTimeout(2000, () => {
          reject(new Error())
        })
        req.end()
      })
    })
  }

  test('Get queue from invalid channel', (done) => {
    getFirstMessage(app, generateEndpoint('invalidChannel'))
      .then((message) => {
        assert(message.data === '')
        assert(message.event === 'fullQueue')
        done()
      })
      .catch((err) => {throw err})
  })

  test('Get queue from valid channel', (done) => {
    getFirstMessage(app, generateEndpoint('validChannel'))
      .then((message) => {
        const dataObj = JSON.parse(message.data)
        assert(dataObj.length === 1 && dataObj[0].name === `${testUser.name}`)
        assert(message.event === 'fullQueue')
        done()
      })
      .catch((err) => {throw err})
  })
})


describe('DELETE /channel/:channel/queue/:userName', () => {
  beforeAll(() => {
    return insertTestChannels()
  })

  afterAll(() => {
    return clearTestChannels()
  })

  test('Delete invalid user from invalid channel queue', (done) => {
    request(app)
      .delete('/channel/invalidChannel/queue/invalidUserName')
      .expect(404, done)
  })

  test('Delete valid user from valid channel queue', (done) => {
    request(app)
      .delete(`/channel/validChannel/queue/${testUser.name}`)
      .expect(200, done)
  })
})

describe('GET /login', () => {
  const state = 'AAAA'
  beforeAll(() => {
    jest.spyOn(crypto, 'randomBytes').mockImplementation(() => ({
      toString: () => 'AAAA'
    }))
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  test('Redirect check', (done) => {
    const ref = '/channels/foobar/queue/view'
    request(app)
      .get('/login')
      .query({ref: ref})
      .expect((res) => {
        const queryData = querystring.parse(res.headers.location.split('?')[1])
        assert(queryData.state, state)
        assert(queryData.state.split(':')[1], ref)
      })
      .expect(302, done)
  })
})
