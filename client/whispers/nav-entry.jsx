import React, { PropTypes } from 'react'
import Entry from '../material/left-nav/entry.jsx'
import IconButton from '../material/icon-button.jsx'
import styles from './whisper.css'

export default class WhisperNavEntry extends React.Component {
  static propTypes = {
    user: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
  };

  _handleClose = ::this.onClose;

  render() {
    const { user } = this.props
    const button = <IconButton className={styles.navCloseButton} icon='close' title='Close'
        onClick={this._handleButtonClicked} />

    return <Entry link={`/whispers/${encodeURIComponent(user)}`} button={button}>{user}</Entry>
  }

  onClose() {
    this.props.onClose(this.props.user)
  }
}
