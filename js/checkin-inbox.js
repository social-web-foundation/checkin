import {
  html,
  css,
  LitElement
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'

import { CheckinElement } from './checkin-element.js'
import { CheckinActivityElement } from './checkin-activity.js'

export class CheckinInboxElement extends CheckinElement {
  static styles = css`
  .spinner-container {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  .half-spinner {
    --size: 50%;
  }
  `

  MAX_ACTIVITIES = 20
  MAX_TIME_WINDOW = 3 * 24 * 60 * 60 * 1000 // three days

  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      _error: { type: String, state: true },
      _activities: { type: Array, state: true }
    }
  }

  constructor () {
    super()
  }

  connectedCallback () {
    super.connectedCallback()
    this._loadActivities()
  }

  render () {
    return (this._error)
      ? html`<sl-alert>${this._error}</sl-alert>`
      : html`
          <h2>Latest activities</h2>
          <div class="inbox-activities">
          ${(this._activities)
            ? this._activities.map(a =>
                html`<checkin-activity .activity=${a}></checkin-activity>`
              )
            : html`
              <div class="spinner-container">
                <sl-spinner class="half-spinner"></sl-spinner>
              </div>
              `
          }
          </div>
          `
  }

  async _loadActivities () {
    const activitiesJSON = sessionStorage.getItem('inbox-activities')
    const cached = (activitiesJSON)
      ? JSON.parse(activitiesJSON)
      : []

    let inbox = sessionStorage.getItem('inbox')
    if (!inbox) {
      const actor = await this.getActor()
      inbox = await this.toId(actor.inbox)
      sessionStorage.setItem('inbox', inbox)
    }

    const latestId = (cached && cached.length > 0)
      ? cached[0].id
      : null

    const activities = []

    for await (const activity of this.items(inbox)) {
      if (latestId && activity.id === latestId) {
        break
      }
      if (this.isGeo(activity)) {
        activities.push(activity)
        // Updates
        this._activities = [
          ...activities,
          ...cached
        ].slice(0, this.MAX_ACTIVITIES)
      }
      if (activities.length >= this.MAX_ACTIVITIES) {
        break
      }
      if ((new Date(activity.published)).getTime() <= Date.now() - this.MAX_TIME_WINDOW) {
        break
      }
    }

    sessionStorage.setItem('inbox-activities', JSON.stringify(this._activities))
  }

  isGeo (object) {
    return ['Arrive', 'Leave', 'Travel'].includes(object.type)
  }
}

customElements.define('checkin-inbox', CheckinInboxElement)
