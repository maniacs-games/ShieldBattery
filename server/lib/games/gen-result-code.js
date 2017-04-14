// Generates a token that can be used as a shared secret to verify the game results submission of a
// given client

const BLOCK_SIZE = 4
const PAD_CHARS = '0000'
const BASE = 36
const MAX = Math.pow(BASE, BLOCK_SIZE)

function rand() {
  return (Math.random() * MAX << 0).toString(BASE)
}

function padToBlockSize(str) {
  return (PAD_CHARS + str).slice(-BLOCK_SIZE)
}

export default function genResultCode() {
  return padToBlockSize(rand()) + padToBlockSize(rand())
}
