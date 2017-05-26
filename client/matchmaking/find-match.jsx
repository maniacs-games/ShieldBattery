import React from 'react'
import { connect } from 'react-redux'
import { Set } from 'immutable'
import { findMatch, getPreferences, setPreferences } from './action-creators'
import { closeOverlay } from '../activities/action-creators'
import styles from './find-match.css'

import CheckBox from '../material/check-box.jsx'
import RacePicker from '../lobbies/race-picker.jsx'
import RaisedButton from '../material/raised-button.jsx'

// TODO(2Pac): Remove this once we start supporting more matchmaking types
const MATCHMAKING_TYPE = '1v1'

@connect(state => ({ preferences: state.matchmakingPreferences, auth: state.auth }))
export default class FindMatch extends React.Component {
  state = {
    useAlternateRace: false,
  }

  componentDidMount() {
    const { user } = this.props.auth
    // this.props.dispatch(getPreferences(user.name, MATCHMAKING_TYPE))
  }

  renderAlternateRace() {
    const { useAlternateRace } = this.state
    if (!useAlternateRace) {
      return null
    }

    return (<div>
      <h5 className={styles.alternateRaceTitle}>Alternate race</h5>
      <h6 className={styles.alternateRaceCaption}>
        Select a race to be used whenever your opponent has selected the same primary race.
      </h6>
      <RacePicker className={styles.racePicker} race='r' onSetRace={this.onSetAlternateRace} />
    </div>)
  }

  render() {
    const { useAlternateRace } = this.state

    return (<div className={styles.root}>
      <div>
        <h3 className={styles.title}>Find match</h3>
        <h5 className={styles.raceTitle}>Race</h5>
        <RacePicker className={styles.racePicker} race='r' onSetRace={this.onSetRace} />
        <CheckBox label='Use alternate race to avoid mirror matchups'
            checked={useAlternateRace} onChange={this.onUseAlternateRaceClick} />
        { this.renderAlternateRace() }
        <h5 className={styles.preferredMapsTitle}>Preferred maps</h5>
        <h6 className={styles.preferredMapsCaption}>
          Select up to 2 maps to be used in the per-match map pool. Your selections will be combined
          with your opponent's to form the 4 map pool. Any unused selections will be replaced with a
          random map choice for each match.
        </h6>
      </div>
      <div>
        <RaisedButton label='Find match' onClick={this.onFindMatchClick} />
      </div>
    </div>)
  }

  onSetRace = race => {
    this.setState({
      race,
    })
  }

  onUseAlternateRaceClick = event => {
    this.setState({
      useAlternateRace: event.target.checked,
    })
  }

  onSetAlternateRace = alternateRace => {
    this.setState({
      alternateRace,
    })
  }

  onFindMatchClick = () => {
    const { dispatch, matchmakingPreferences, auth: { user: { name: username } } } = this.props
    getPreferences(username, MATCHMAKING_TYPE)
    /* this.props.dispatch(setPreferences(username, MATCHMAKING_TYPE, preferences))
    const preferences = matchmakingPreferences.get([username, MATCHMAKING_TYPE])

    dispatch(findMatch(MATCHMAKING_TYPE, race, alternateRace))
    dispatch(setPreferences(username, MATCHMAKING_TYPE, preferences))
    dispatch(closeOverlay())*/
  }
}
