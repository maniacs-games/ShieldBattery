import { Map, Record, Set } from 'immutable'
import keyedReducer from '../reducers/keyed-reducer'
import {
  MATCHMAKING_GET_PREFERENCES_BEGIN,
  MATCHMAKING_GET_PREFERENCES,
  MATCHMAKING_SET_PREFERENCES,
} from '../actions'

const Preferences = new Record({
  race: 'r',
  alternateRace: null,
  mapPoolId: -1,
  preferredMaps: new Set(),

  locallyModified: false,
  isRequesting: false,
  lastError: null,
})
const MatchmakingPreferencesState = new Record({
  userTypes: new Map(),
})

const updatePreferences = (state, payload, data) => {
  const { username, matchmakingType } = payload
  // Each user can have preferences for different matchmaking type, so we make the key of the map
  // to be a tuple of [username, matchmakingType]
  const key = [username, matchmakingType]
  return state.updateIn(['userTypes', key], (p = new Preferences()) => p.merge(data))
}

export default keyedReducer(new MatchmakingPreferencesState(), {
  [MATCHMAKING_GET_PREFERENCES_BEGIN](state, action) {
    const data = {
      isRequesting: true,
    }
    return updatePreferences(state, action.payload, data)
  },

  /* [MATCHMAKING_PREFERENCES](state, action) {
    if (action.error) {
      const data = {
        lastError: action.payload,
        isRequesting: false,
      }
      return updatePreferences(state, action.meta, data)
    }

    const data = {
      ...action.payload,
      lastError: null,
      isRequesting: false,
    }
    return updatePreferences(state, action.meta, data)
  },*/

  [MATCHMAKING_SET_PREFERENCES](state, action) {
    if (action.error) {
      const data = {
        lastError: action.payload,
        isRequesting: false,
      }
      return updatePreferences(state, action.meta, data)
    }

    const data = {
      ...action.payload,
      lastError: null,
      isRequesting: false,
    }
    return updatePreferences(state, action.meta, data)
  }
})
