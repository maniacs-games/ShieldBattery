import { dispatch } from '../dispatch-registry'
import {
  CHAT_INIT_CHANNEL,
  CHAT_UPDATE_MESSAGE,
  CHAT_UPDATE_USER_ACTIVE,
  CHAT_UPDATE_USER_IDLE,
  CHAT_UPDATE_USER_OFFLINE,
} from '../actions'

const eventToAction = {
  init(channel, event, siteSocket) {
    return {
      type: CHAT_INIT_CHANNEL,
      payload: {
        channel,
        activeUsers: event.activeUsers,
      }
    }
  },

  message(channel, event) {
    // TODO(tec27): handle different types of messages (event.data.type)
    return {
      type: CHAT_UPDATE_MESSAGE,
      payload: {
        channel,
        time: event.sent,
        user: event.user,
        message: event.data.text,
      }
    }
  },

  userActive(channel, event) {
    return {
      type: CHAT_UPDATE_USER_ACTIVE,
      payload: {
        channel,
        user: event.user,
      }
    }
  },

  userIdle(channel, event) {
    return {
      type: CHAT_UPDATE_USER_IDLE,
      payload: {
        channel,
        user: event.user,
      }
    }
  },

  userOffline(channel, event) {
    return {
      type: CHAT_UPDATE_USER_OFFLINE,
      payload: {
        channel,
        user: event.user,
      }
    }
  },
}

export default function registerModule({ siteSocket }) {
  siteSocket.registerRoute('/chat/:channel', (route, event) => {
    if (!eventToAction[event.action]) return

    const action = eventToAction[event.action](route.params.channel, event, siteSocket)
    if (action) dispatch(action)
  })
}
