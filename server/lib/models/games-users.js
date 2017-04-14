import db from '../db'

export async function createGameUserRecord(client,
    { userId, gameId, startTime, selectedRace, resultCode }) {
  const query = `
    INSERT INTO games_users (
      user_id, game_id, start_time, selected_race, result_code,
      reported_results, reported_at, assigned_race, result
    ) VALUES (
      $1, $2, $3, $4, $5,
      NULL, NULL, NULL, NULL
    )
  `
  const params = [
    userId,
    gameId,
    startTime,
    selectedRace,
    resultCode,
  ]

  await client.query(query, params)
}

export async function deleteUserRecordsForGame(gameId) {
  const { client, done } = await db()
  try {
    await client.query('DELETE FROM games_users WHERE game_id = $1', [gameId])
  } finally {
    done()
  }
}
