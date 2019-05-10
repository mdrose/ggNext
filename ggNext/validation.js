'use strict'

function validateFriendCode(req, res, next) {
  const friendCode = req.user.friendCode.trim()
  if (!(/^\d{4}[ -]?\d{4}[ -]?\d{4}$/.test(friendCode))) {
    console.log(`User ${req.user.name} gave an invalid friend code`)
    res.send('You must enter a valid friend code ie. "!challenge 2817-2891-0029"')
  } else {
    next()
  }
}

module.exports = { validateFriendCode }
