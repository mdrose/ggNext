'use strict'

// still need to deal with failed writes

const sseConnections = {}

function createSSEConn(res, group) {
  res.status(200).set({
           'Content-Type': 'text/event-stream',
           'Cache-Control': 'no-cache',
           'Connection': 'keep-alive'
  })

  const intervalID = setInterval(() => {sendData('heartbeat', 'heartbeat')}, 45000)
  res.on('close', () => {
    clearInterval(intervalID)
    removeSubscriber(res, group)
    console.log(`Client connection lost with IP ${res.socket.remoteAddress}. Unsubscribed from ${group}`)
  })

  function sendData(data, event) {
    let respBody = ''
    if (event !== undefined) {
      respBody += `event: ${event}\n`
    }
    respBody += `data: ${data}\n\n`
    res.write(respBody)
  }

  const sseConn = Object.freeze({
    sendData
  })
  addSubscriber(sseConn, group)
  console.log(`Established client connection with IP ${res.socket.remoteAddress}. Subscribed to ${group}`)
  return sseConn
}

function addSubscriber(conn, group) {
  if (Array.isArray(sseConnections[group])) {
    sseConnections[group].push(conn)
  } else {
    sseConnections[group] = [conn]
  }
}

function removeSubscriber(subConn, group) {
  for (const [i, conn] of sseConnections[group].entries()) {
    if (subConn === conn) {
      sseConnections[group].splice(i, 1)
    }
  }
}

function publishData(data, group, event) {
  const subscribers = sseConnections[group]
  subscribers.forEach((conn) => {
    conn.sendData(data, event)
  })
}

module.exports = {
  createSSEConn,
  publishData,
  removeSubscriber
}
