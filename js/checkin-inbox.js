import {
  html,
  css,
  LitElement
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'

import { CheckinElement } from './checkin-element.js'
import { CheckinActivityElement } from './checkin-activity.js'

const ACTIVITY_TYPES = [
  'Activity',
  'IntransitiveActivity',
  'Accept',
  'Add',
  'Announce',
  'Arrive',
  'Block',
  'Create',
  'Delete',
  'Dislike',
  'Flag',
  'Follow',
  'Ignore',
  'Invite',
  'Join',
  'Leave',
  'Like',
  'Listen',
  'Move',
  'Offer',
  'Question',
  'Reject',
  'Read',
  'Remove',
  'TentativeReject',
  'TentativeAccept',
  'Travel',
  'Undo',
  'Update',
  'View'
]

const NON_ACTIVITY_TYPES = [
  'Application',
  'Group',
  'Organization',
  'Person',
  'Service',
  'Article',
  'Audio',
  'Document',
  'Event',
  'Image',
  'Note',
  'Page',
  'Place',
  'Profile',
  'Relationship',
  'Tombstone',
  'Video',
  'Mention',
  'Collection',
  'OrderedCollection',
  'CollectionPage',
  'OrderedCollectionPage',
  'Link'
]

const ACTIVITY_PROPS = [
  'actor', 'object', 'target', 'result', 'origin', 'instrument'
]

function isActivity (object) {
  if (!object.type) return false
  const types = Array.isArray(object.type) ? object.type : [object.type]
  for (const type of types) {
    if (ACTIVITY_TYPES.includes(type)) {
      return true
    }
  }
  for (const type of types) {
    if (NON_ACTIVITY_TYPES.includes(type)) {
      return false
    }
  }
  // duck typing
  for (const prop of ACTIVITY_PROPS) {
    if (prop in object) {
      return true
    }
  }
}

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
  MAX_TIME_WINDOW = 30 * 24 * 60 * 60 * 1000 // thirty days

  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      _error: { type: String, state: true },
      _activities: { type: Array, state: true, default: [] },
      _isLoading: { type: Boolean, state: true, default: false }
    }
  }

  constructor () {
    super()
  }

  connectedCallback () {
    super.connectedCallback()
    this._loadActivities().then(() => {
      console.log('Activities loaded')
    })
  }

  render () {
    return this._error
      ? html`<sl-alert>${this._error}</sl-alert>`
      : html`
          <h2>
            Latest activities
            ${this._isLoading ? html`<sl-spinner></sl-spinner>` : html``}
          </h2>
          <div class="inbox-activities">
            ${this._activities && this._activities.length > 0
              ? this._activities.map(
                  (a) =>
                    html`<checkin-activity
                      redirect-uri=${this.redirectUri}
                      client-id=${this.clientId}
                      .activity=${a}>
                    </checkin-activity>`
                )
              : html` <div><p>No activities.</p></div> `}
          </div>
        `
  }

  async _loadActivities () {
    this._isLoading = true
    const activitiesJSON = localStorage.getItem('inbox-activities')
    const cached = activitiesJSON ? JSON.parse(activitiesJSON) : []

    if (cached.length > 0) {
      this._activities = [...cached].slice(0, this.MAX_ACTIVITIES)
    }

    let inbox = localStorage.getItem('inbox')
    if (!inbox) {
      const actor = await this.getActor()
      inbox = await this.toId(actor.inbox)
      localStorage.setItem('inbox', inbox)
    }

    const latestId = cached && cached.length > 0 ? cached[0].id : null

    const activities = []

    for await (const activity of this.items(inbox)) {
      console.dir({ id: activity.id, type: activity.type, published: activity.published })
      if (!isActivity(activity)) {
        continue
      }
      if (latestId && activity.id === latestId) {
        break
      }
      if (this.isGeo(activity)) {
        const required = ['id', 'type', 'published', 'actor'].concat(
          (activity.type == 'Arrive')
            ? ['location']
            : (activity.type == 'Leave')
                ? ['object']
                : (activity.type == 'Travel')
                    ? ['target', 'origin']
                    : [])
        activities.push(await this.toObject(activity, { required }))
        this._activities = [...activities, ...cached].slice(
          0,
          this.MAX_ACTIVITIES
        )
      }
      if (activities.length >= this.MAX_ACTIVITIES) {
        break
      }
      const timestamp = activity.updated
        ? activity.updated
        : activity.published

      if (new Date(timestamp).getTime() <= Date.now() - this.MAX_TIME_WINDOW) {
        break
      }
    }

    if (this._activities) {
      localStorage.setItem(
        'inbox-activities',
        JSON.stringify(this._activities)
      )
    }

    this._isLoading = false
  }

  isGeo (object) {
    return ['Arrive', 'Leave', 'Travel'].includes(object.type)
  }
}

customElements.define('checkin-inbox', CheckinInboxElement)
