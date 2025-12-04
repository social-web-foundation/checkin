import {
  html,
  css,
  LitElement
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'
import { CheckinElement } from './checkin-element.js'

export class CheckinChoosePlaceElement extends CheckinElement {
  static styles = css`
    :host {
      display: block;
      padding: var(--gap, 1rem);
    }
    .form-group {
      margin-bottom: 1rem;
    }
    sl-select,
    sl-textarea,
    sl-radio-group {
      width: 100%;
    }
    sl-radio-group {
      display: flex;
      gap: 1rem;
    }
    .actions {
      text-align: right;
    }
  `

  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      _error: { type: String, state: true },
      _lat: { type: Number, state: true },
      _lon: { type: Number, state: true },
      _places: { type: Array, state: true },
      _selectedPlace: { type: String, state: true },
      _note: { type: String, state: true },
      _privacy: { type: String, state: true }
    }
  }

  constructor () {
    super()
    this._selectedPlace = ''
    this._note = ''
    this._privacy = 'public'
  }

  connectedCallback () {
    super.connectedCallback()
    this.getPosition()
      .then((pos) => {
        this._lat = Number(pos.coords.latitude.toFixed(5))
        this._lon = Number(pos.coords.longitude.toFixed(5))
        return this.getPlaces(pos.coords.latitude, pos.coords.longitude)
      })
      .then((places) => {
        this._places = places
      })
      .catch((err) => {
        this._error = err.message
      })
  }

  getPosition () {
    return new Promise((resolve, reject) => {
      try {
        navigator.geolocation.getCurrentPosition(resolve)
      } catch (err) {
        reject(err)
      }
    })
  }

  async getPlaces (latitude, longitude) {
    const key = `places:${this._lat.toFixed(5)},${this._lon.toFixed(5)}`
    const cached = localStorage.getItem(key)
    if (cached) {
      return JSON.parse(cached)
    }

    const [minLon, minLat, maxLon, maxLat] = this.bbox(
      latitude,
      longitude,
      100
    )

    const res = await fetch(
      `https://places.pub/search?bbox=${minLon},${minLat},${maxLon},${maxLat}`,
      {
        headers: {
          Accept:
            'application/activity+json,application/lrd+json,application/json'
        }
      }
    )

    if (!res.ok) {
      throw new Error('Failed to fetch nearby places.')
    }

    const collection = await res.json()
    const places = collection.items.filter((p) => p.name)
    localStorage.setItem(key, JSON.stringify(places))
    return places
  }

  bbox (lat, lon, distance) {
    const EARTH_RADIUS_M = 6371000
    const degToRad = Math.PI / 180
    const radToDeg = 180 / Math.PI

    const latRad = lat * degToRad
    const radDist = distance / EARTH_RADIUS_M
    const deltaLat = radDist * radToDeg
    const deltaLon = (radDist * radToDeg) / Math.cos(latRad)

    const minLat = Number((lat - deltaLat).toFixed(5))
    const maxLat = Number((lat + deltaLat).toFixed(5))
    const minLon = Number((lon - deltaLon).toFixed(5))
    const maxLon = Number((lon + deltaLon).toFixed(5))

    return [minLon, minLat, maxLon, maxLat]
  }

  _onPlaceChange (event) {
    this._selectedPlace = event.target.value
  }

  _onNoteInput (event) {
    this._note = event.target.value
  }

  _onPrivacyChange (event) {
    this._privacy = event.target.value
  }

  render () {
    if (this._error) {
      return html`<sl-alert variant="danger">${this._error}</sl-alert>`
    }
    return html`
      ${!this._places
        ? html`<sl-spinner></sl-spinner>`
        : html`
            <div class="form-group">
              <sl-select
                label="Place"
                placeholder="Select a place"
                .value=${this._selectedPlace}
                @sl-change=${this._onPlaceChange}
              >
                ${this._places.map(
                  (place) =>
                    html`<sl-option value="${place.id}"
                      >${place.name}</sl-option
                    >`
                )}
              </sl-select>
            </div>
            <div class="form-group">
              <sl-textarea
                label="Note"
                placeholder="Add a note"
                .value=${this._note}
                @sl-input=${this._onNoteInput}
              ></sl-textarea>
            </div>
            <div class="form-group">
              <sl-radio-group
                label="Visibility"
                name="visibility"
                .value=${this._privacy}
                @sl-change=${this._onPrivacyChange}
              >
                <sl-radio value="public">Public</sl-radio>
                <sl-radio value="private">Private</sl-radio>
              </sl-radio-group>
            </div>
            <div class="form-group actions">
              <sl-button
                variant="primary"
                ?disabled=${!this._selectedPlace}
                @click=${this._submitCheckin}
              >
                Check In
              </sl-button>
            </div>
          `}
    `
  }

  async _submitCheckin () {
    const place = this._places.find((p) => p.id === this._selectedPlace)
    if (!place) return

    const actor = await this.getActor()
    const content = (this._note) ? this._note.trim() : undefined

    const activity = {
      actor: {
        id: actor.id,
        name: actor.name,
        url: actor.url
      },
      type: 'Arrive',
      location: {
        id: place.id,
        name: place.name,
        url: place.url
      },
      content
    }

    const followers = await this.toId(actor.followers)

    if (this._privacy === 'public') {
      activity.to = 'https://www.w3.org/ns/activitystreams#Public'
      activity.cc = followers
    } else {
      activity.to = followers
    }

    activity.summaryMap = {
      en: this.makeSummary(activity)
    }

    await this.doActivity(activity)
    window.location = '/'
  }
}

customElements.define('checkin-choose-place', CheckinChoosePlaceElement)
