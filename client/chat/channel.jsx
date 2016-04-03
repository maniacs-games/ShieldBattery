import React, { PropTypes } from 'react'
import ReactDom from 'react-dom'
import { connect } from 'react-redux'
import { routeActions } from 'redux-simple-router'
import { sendMessage, retrieveInitialMessageHistory } from './action-creators'
import styles from './channel.css'

import ContentLayout from '../content/content-layout.jsx'
import { ChatMessage, ChatMessageLayout } from './message.jsx'
import TextField from '../material/text-field.jsx'

class BaseMessage extends React.Component {
  static propTypes = {
    record: PropTypes.object.isRequired,
  };

  shouldComponentUpdate(nextProps) {
    return this.record !== nextProps.record
  }
}

class UserOnlineMessage extends BaseMessage {
  render() {
    const { time, user } = this.props.record
    return (<ChatMessageLayout time={time} className={styles.systemMessage}>
      <span>
        &gt;&gt; <span className={styles.important}>{user}</span> has come online
      </span>
    </ChatMessageLayout>)
  }
}

class UserOfflineMessage extends BaseMessage {
  render() {
    const { time, user } = this.props.record
    return (<ChatMessageLayout time={time} className={styles.systemMessage}>
      <span>
        &lt;&lt; <span className={styles.important}>{user}</span> has gone offline
      </span>
    </ChatMessageLayout>)
  }
}

class MessageList extends React.Component {
  static propTypes = {
    messages: PropTypes.object.isRequired,
    loading: PropTypes.bool,
  };

  constructor(props) {
    super(props)
    this._shouldAutoScroll = true
  }

  shouldComponentUpdate(nextProps) {
    return this.props.messages !== nextProps.messages
  }

  componentWillUpdate() {
    const node = ReactDom.findDOMNode(this)
    this._shouldAutoScroll = (node.scrollTop + node.offsetHeight) >= node.scrollHeight
  }

  componentDidMount() {
    this.maybeScrollToBottom()
  }

  componentDidUpdate() {
    this.maybeScrollToBottom()
  }

  maybeScrollToBottom() {
    if (this._shouldAutoScroll) {
      const node = ReactDom.findDOMNode(this)
      node.scrollTop = node.scrollHeight
    }
  }

  renderMessage(msg) {
    const { id, type } = msg
    switch (type) {
      case 'message':
        return <ChatMessage key={id} user={msg.from} time={msg.time} text={msg.text} />
      case 'userOnline': return <UserOnlineMessage key={id} record={msg} />
      case 'userOffline': return <UserOfflineMessage key={id} record={msg} />
      default: return null
    }
  }

  render() {
    return (<div className={styles.messages}>
      { this.props.loading ? <div>Loading&hellip;</div> : null }
      { this.props.messages.map(msg => this.renderMessage(msg)) }
    </div>)
  }
}

class UserListEntry extends React.Component {
  static propTypes = {
    user: PropTypes.string.isRequired,
  };

  render() {
    return <li className={styles.userListEntry}>{this.props.user}</li>
  }
}

class UserList extends React.Component {
  static propTypes = {
    users: PropTypes.object.isRequired,
  };

  shouldComponentUpdate(nextProps) {
    return this.props.users !== nextProps.users
  }

  renderSection(title, users) {
    if (!users.size) {
      return null
    }

    return (<div className={styles.userListSection}>
      <p className={styles.userSubheader}>{title}</p>
      <ul className={styles.userSublist}>
        { users.map(u => <UserListEntry user={u} key={u} />) }
      </ul>
    </div>)
  }

  render() {
    const { active, idle, offline } = this.props.users
    return (<div className={styles.userList}>
      { this.renderSection('Active', active) }
      { this.renderSection('Idle', idle) }
      { this.renderSection('Offline', offline) }
    </div>)
  }
}

class Channel extends React.Component {
  static propTypes = {
    channel: PropTypes.object.isRequired,
    onSendChatMessage: PropTypes.func,
  };

  constructor(props) {
    super(props)
    this._handleChatEnter = ::this.onChatEnter
  }

  render() {
    const { channel } = this.props
    return (<div className={styles.container}>
      <div className={styles.messagesAndInput}>
        <MessageList loading={channel.loadingHistory} messages={channel.messages} />
        <TextField ref='chatEntry' className={styles.chatInput} label='Send a message'
            maxLength={500} floatingLabel={false} allowErrors={false} autoComplete='off'
            onEnterKeyDown={this._handleChatEnter}/>
      </div>
      <UserList users={this.props.channel.users} />
    </div>)
  }

  onChatEnter() {
    if (this.props.onSendChatMessage) {
      this.props.onSendChatMessage(this.refs.chatEntry.getValue())
    }
    this.refs.chatEntry.clearValue()
  }
}

const mapStateToProps = state => {
  return {
    user: state.auth.user,
    chat: state.chat,
  }
}

function isLeavingChannel(oldProps, newProps) {
  return (
    oldProps.routeParams === newProps.routeParams &&
    oldProps.chat.byName.has(oldProps.routeParams.channel) &&
    !newProps.chat.byName.has(oldProps.routeParams.channel)
  )
}

@connect(mapStateToProps)
export default class ChatChannelView extends React.Component {
  constructor(props) {
    super(props)
    this._handleSendChatMessage = ::this.onSendChatMessage
  }

  componentWillReceiveProps(nextProps) {
    if (isLeavingChannel(this.props, nextProps)) {
      this.props.dispatch(routeActions.push('/'))
    }
  }

  componentDidMount() {
    if (this._isInChannel()) {
      const routeChannel = this.props.routeParams.channel
      this.props.dispatch(retrieveInitialMessageHistory(routeChannel))
    }
  }

  componentDidUpdate(prevProps) {
    if (this._isInChannel()) {
      const routeChannel = this.props.routeParams.channel
      this.props.dispatch(retrieveInitialMessageHistory(routeChannel))
    }
  }

  renderJoinChannel() {
    return <span>Not in this channel. Join it?</span>
  }

  renderChannel() {
    return (<Channel channel={this.props.chat.byName.get(this.props.routeParams.channel)}
        onSendChatMessage={this._handleSendChatMessage}/>)
  }

  render() {
    const routeChannel = this.props.routeParams.channel
    const title = `#${routeChannel}`

    return (<ContentLayout title={title}>
      { this._isInChannel() ? this.renderChannel() : this.renderJoinChannel() }
    </ContentLayout>)
  }

  onSendChatMessage(msg) {
    this.props.dispatch(sendMessage(this.props.routeParams.channel, msg))
  }

  _isInChannel() {
    const routeChannel = this.props.routeParams.channel
    return this.props.chat.byName.has(routeChannel)
  }
}
