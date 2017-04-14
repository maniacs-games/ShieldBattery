import transact from '../db/transaction'
import { findUserIdsForNames } from '../models/users'
import { createGameRecord } from '../models/games'
import { createGameUserRecord } from '../models/games-users'
import genResultCode from './gen-result-code'

const VALID_GAME_TYPES = [
  'melee',
  'ffa',
  'oneVOne',
  'ums',
  'teamMelee',
  'teamFfa',
  'topVBottom',
]

const HAVE_SUB_TYPES = [
  'teamMelee',
  'teamFfa',
  'topVBottom',
]

const HAS_MULTIPLE_TEAMS = [
  'ums',
  'teamMelee',
  'teamFfa',
  'topVBottom',
]

function validateGameConfig(config) {
  const { gameType, gameSubType, teams } = config

  if (!gameType || gameSubType === undefined || gameSubType === null || !teams) {
    throw new TypeError('Game config missing properties')
  }
  if (!VALID_GAME_TYPES.includes(gameType)) {
    throw new TypeError('Invalid game type: ' + gameType)
  }
  const needsSubType = HAVE_SUB_TYPES.includes(gameType)
  if ((needsSubType && (gameSubType < 1 || gameSubType > 7)) ||
      (!needsSubType && gameSubType !== 0)) {
    throw new TypeError('Invalid game sub-type: ' + gameSubType)
  }
  if (!config.teams.length || (!HAS_MULTIPLE_TEAMS.includes(gameType) && config.teams.length > 1)) {
    throw new TypeError('Invalid teams length: ' + config.teams.length)
  }
}

function mapRaceToDb(race) {
  switch (race) {
    case 'r': return 'random'
    case 'p': return 'protoss'
    case 't': return 'terran'
    case 'z': return 'zerg'
    default: throw new RangeError('invalid race: ' + race)
  }
}

// Creates the necessary game records in the database, returning the information necessary to
// distribute to players for collecting results.
//
// mapHash: the hash identifier for the map in use
// gameConfig: An object describing the configuration of the game, in the format:
//   { gameType, gameSubType, teams: [ [team1Players], [team2Players], ...] }
//   For games that begin teamless, all players may be on a single team.
//   Entries in the team lists are in the format { name, race = (p,r,t,z), isComputer }
export default async function createGame(mapHash, gameConfig) {
  validateGameConfig(gameConfig)

  const humanPlayers = gameConfig.teams.reduce((r, team) => {
    const humans = team.filter(p => !p.isComputer)
    r.push(...humans)
    return r
  }, [])
  const humanNames = humanPlayers.map(p => p.name)
  const userIdsMap = await findUserIdsForNames(humanNames)
  for (const name of humanNames) {
    if (!userIdsMap.has(name)) {
      throw new RangeError('Invalid human player: ' + name)
    }
  }

  const configToStore = {
    gameType: gameConfig.gameType,
    gameSubType: gameConfig.gameSubType,
    teams: gameConfig.teams.map(team => team.map(p => ({
      id: p.isComputer ? -1 : userIdsMap.get(p.name),
      race: mapRaceToDb(p.race),
      isComputer: p.isComputer
    })))
  }

  const resultCodes = humanNames.reduce((r, name) => {
    r.set(name, genResultCode())
    return r
  }, new Map())

  let gameId

  await transact(async client => {
    const startTime = new Date()
    gameId = await createGameRecord(client, { startTime, mapHash, gameConfig: configToStore })
    const userPromises = humanPlayers.map(p => createGameUserRecord(client, {
      userId: userIdsMap.get(p.name),
      gameId,
      startTime,
      selectedRace: mapRaceToDb(p.race),
      resultCode: resultCodes.get(p.name)
    }))
    await Promise.all(userPromises)
  })

  return { gameId, resultCodes }
}
