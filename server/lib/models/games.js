import db from '../db'

export async function createGameRecord(client, { startTime, mapHash, gameConfig }) {
  const query = `
    INSERT INTO games (
      id, start_time, map_hash, config, disputable,
      dispute_requested, dispute_reviewed, game_length
    ) VALUES (
      uuid_generate_v4(), $1, $2, $3, FALSE,
      FALSE, FALSE, NULL
    ) RETURNING id
  `

  const params = [
    startTime,
    '\\x' + mapHash,
    gameConfig,
  ]

  const result = await client.query(query, params)
  return result.rows[0].id
}

export async function deleteRecordForGame(gameId) {
  const { client, done } = await db()
  try {
    await client.query('DELETE FROM games WHERE id = $1', [gameId])
  } finally {
    done()
  }
}
