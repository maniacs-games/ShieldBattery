import fetch from '../network/fetch'
import createSiteSocketAction from '../action-creators/site-socket-action-creator'
import {
  MATCHMAKING_ACCEPT_BEGIN,
  MATCHMAKING_ACCEPT,
  MATCHMAKING_CANCEL_BEGIN,
  MATCHMAKING_CANCEL,
  MATCHMAKING_FIND_BEGIN,
  MATCHMAKING_FIND,
  MATCHMAKING_GET_PREFERENCES_BEGIN,
  MATCHMAKING_GET_PREFERENCES,
  MATCHMAKING_SET_PREFERENCES_BEGIN,
  MATCHMAKING_SET_PREFERENCES
} from '../actions'


export const findMatch = (type, race) => createSiteSocketAction(MATCHMAKING_FIND_BEGIN,
    MATCHMAKING_FIND, '/matchmaking/find', { type, race })

export const cancelFindMatch = () => createSiteSocketAction(MATCHMAKING_CANCEL_BEGIN,
    MATCHMAKING_CANCEL, '/matchmaking/cancel')

export const acceptMatch = () => createSiteSocketAction(MATCHMAKING_ACCEPT_BEGIN,
    MATCHMAKING_ACCEPT, '/matchmaking/accept')

export function getPreferences(username, matchmakingType) {
  fetch('/api/1/matchmakingPreferences/' + encodeURIComponent(matchmakingType))
  /* return dispatch => {
    dispatch({
      type: MATCHMAKING_GET_PREFERENCES_BEGIN,
      payload: { username, matchmakingType },
    })

    dispatch({
      type: MATCHMAKING_GET_PREFERENCES,
      payload: fetch('/api/1/matchmakingPreferences/' + encodeURIComponent(matchmakingType)),
      meta: { username, matchmakingType },
    })
  }*/
}

export function setPreferences(username, matchmakingType, preferences) {
  /* return (dispatch, getState) => {
    const preferences = getState().matchmakingPreferences.get([username, matchmakingType])
    if (!preferences.locallyModified) {
      // If we don't have locally modified settings, our client-side state matches the state that's
      // persisted on the server, so we don't have to perform unnecessary server round trip
      return
    }
    const params = { method: 'post', body: JSON.stringify(...preferences) }
    dispatch({
      type: MATCHMAKING_PREFERENCES,
      payload: fetch('/api/1/matchmakingPreferences/' + encodeURIComponent(matchmakingType),
          params),
      meta: { username, matchmakingType },
    })
  }*/
}

export function setPreferencesLocally(username, matchmakingType, preferences) {
  return dispatch => {
    dispatch({
      type: MATCHMAKING_SET_PREFERENCES_BEGIN,
      payload: { username, matchmakingType }
    })

    const params = { method: 'post', body: JSON.stringify(...preferences) }
    dispatch({
      type: MATCHMAKING_SET_PREFERENCES,
      payload: fetch('/api/1/matchmakingPreferences/' + encodeURIComponent(matchmakingType),
          params),
      meta: { username, matchmakingType },
    })
  }
}
