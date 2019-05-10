'use strict'

const assert = require('assert')
const { validateFriendCode } = require('./validation')

describe('validateFriendCode unit tests', () => {
  const nextMock = jest.fn()
  const resMock = {send: jest.fn()}
  const createMockRequest = (friendCode) => ({user: {friendCode}})

  beforeEach(() => {
    nextMock.mockClear()
    resMock.send.mockClear()
  })

  test('Normal friend code input', () => {
    const friendCode = '2817-3912-9182'
    validateFriendCode(createMockRequest(friendCode), resMock, nextMock)
    assert(nextMock.mock.calls.length === 1)
    assert(resMock.send.mock.calls.length === 0)
  })

  test('Valid friend code. No separator', () => {
    const friendCode = '281739129182'
    validateFriendCode(createMockRequest(friendCode), resMock, nextMock)
    assert(nextMock.mock.calls.length === 1)
    assert(resMock.send.mock.calls.length === 0)
  })

  test('Valid friend code. Separated with spaces', () => {
    const friendCode = '2817 3912 9182'
    validateFriendCode(createMockRequest(friendCode), resMock, nextMock)
    assert(nextMock.mock.calls.length === 1)
    assert(resMock.send.mock.calls.length === 0)
  })

  test('Valid with leading spaces', () => {
    const friendCode = ' 2811-3912-9382 '
    validateFriendCode(createMockRequest(friendCode), resMock, nextMock)
    assert(nextMock.mock.calls.length === 1)
    assert(resMock.send.mock.calls.length === 0)
  })

  test('Invalid friend code. Too many digits.', () => {
    const friendCode = '2817-3912-91822'
    validateFriendCode(createMockRequest(friendCode), resMock, nextMock)
    assert(nextMock.mock.calls.length === 0)
    assert(resMock.send.mock.calls.length === 1)
  })

  test('Invalid friend code. Not numeric', () => {
    const friendCode = '281z-3a12-9c82'
    validateFriendCode(createMockRequest(friendCode), resMock, nextMock)
    assert(nextMock.mock.calls.length === 0)
    assert(resMock.send.mock.calls.length === 1)
  })
})
