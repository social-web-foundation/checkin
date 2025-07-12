import {
  html,
  css,
  LitElement
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'

import { CheckinElement } from './checkin-element.js'

export class CheckinChoosePlaceElement extends CheckinElement {
  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      _error: { type: String, state: true },
      _lat: { type: Number, state: true },
      _lon: { type: Number, state: true },
      _places: { type: Array, state: true }
    }
  }

  constructor () {
    super()
  }

  connectedCallback () {
    super.connectedCallback()
    this.getPosition()
      .then((pos) => {
        const { latitude, longitude } = pos.coords
        this._lat = Number(latitude.toFixed(5))
        this._lon = Number(longitude.toFixed(5))
        this.getPlaces(latitude, longitude)
          .then((places) => {
            this._places = places
          })
          .catch(err => {
            this._error = err.message
          })
      })
      .catch(err => {
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

    const cached = sessionStorage.getItem(`places:${this._lat.toFixed(5)},${this._lon.toFixed(5)}`)

    if (cached) {
      return JSON.parse(cached)
    }

    const [minLongitude, minLatitude, maxLongitude, maxLatitude] = this.bbox(
      latitude,
      longitude,
      100
    )

    const res = await fetch(
       `https://places.pub/search?bbox=${minLongitude},${minLatitude},${maxLongitude},${maxLatitude}`
    )

    if (!res.ok) {
      throw new Error('Failed to fetch nearby places.')
    }

    const collection = await res.json()
    const places = collection.items.filter((p) => p.name)
    sessionStorage.setItem(`places:${this._lat.toFixed(5)},${this._lon.toFixed(5)}`, JSON.stringify(places))
    return places
  }

  bbox (lat, lon, distance) {
    const EARTH_RADIUS_M = 6_371_000
    const degToRad = Math.PI / 180
    const radToDeg = 180 / Math.PI

    // convert center latitude to radians
    const latRad = lat * degToRad

    // angular distance in radians on the earth’s surface
    const radDist = distance / EARTH_RADIUS_M

    // delta in degrees latitude
    const deltaLat = radDist * radToDeg

    // delta in degrees longitude, corrected by latitude
    const deltaLon = (radDist * radToDeg) / Math.cos(latRad)

    const minLat = Number((lat - deltaLat).toFixed(5))
    const maxLat = Number((lat + deltaLat).toFixed(5))
    const minLon = Number((lon - deltaLon).toFixed(5))
    const maxLon = Number((lon + deltaLon).toFixed(5))

    return [minLon, minLat, maxLon, maxLat]
  }

  render () {
    return (this._error)
      ? html`<sl-alert>${this._error}</sl-alert>`
      : html`
      <h2>Nearby places</h2>
      <div class="location-container">
        ${this._places
          ? html`<div id="places-list" style="margin-top: 1em;">
              <ul>
                ${this._places.map(
                  (place) =>
                    html`<li>
                      ${place.name}
                      <sl-button
                        class="checkin-button"
                        data-place-id="${place.id}"
                        data-place-name="${place.name}"
                        size="small"
                        @click=${this._checkin.bind(this)}
                        >Checkin</sl-button
                      >
                    </li>`
                )}
              </ul>
            </div>`
          : html`<sl-spinner style="font-size: 2rem;"></sl-spinner>`}
      </div>
    `
  }

  async _checkin (e) {
    const btn = e.currentTarget
    const placeId = btn.dataset.placeId
    const place = await this.toObject(placeId)
    const actor = await this.getActor()
    let activity = {
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
      to: 'https://www.w3.org/ns/activitystreams#Public'
    }

    activity.summaryMap = {
      en: this.makeSummary(activity)
    }

    activity = await this.doActivity(activity)

    // Go to the inbox
    window.location.hash = ''
  }
}

customElements.define(
  'checkin-choose-place',
  CheckinChoosePlaceElement
)
