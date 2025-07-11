import {
  html,
  css,
  LitElement,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";
import { render } from 'https://cdn.jsdelivr.net/npm/@lit-labs/ssr@latest/+esm';

import { CheckinElement } from './checkin-element.js'

export class CheckinMainElement extends CheckinElement {

  static get properties() {
    return {
      redirectUri: { type: String, attribute: "redirect-uri" },
      clientId: { type: String, attribute: "client-id" },
      _error: { type: String, state: true },
      _lat: { type: Number, state: true },
      _lon: { type: Number, state: true },
      _places: { type: Array, state: true },
    };
  }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      this._lat = latitude;
      this._lon = longitude;

      const [minLongitude, minLatitude, maxLongitude, maxLatitude] = this.bbox(
        latitude,
        longitude,
        100
      );

      const res = await fetch(
        `https://places.pub/search?bbox=${minLongitude},${minLatitude},${maxLongitude},${maxLatitude}`
      );

      if (!res.ok) {
        throw new Error("Failed to fetch nearby places.");
      }

      const collection = await res.json();
      this._places = collection.items.filter(p => p.name)
    });
  }

  bbox(lat, lon, distance) {
    const EARTH_RADIUS_M = 6_371_000;
    const degToRad = Math.PI / 180;
    const radToDeg = 180 / Math.PI;

    // convert center latitude to radians
    const latRad = lat * degToRad;

    // angular distance in radians on the earth’s surface
    const radDist = distance / EARTH_RADIUS_M;

    // delta in degrees latitude
    const deltaLat = radDist * radToDeg;

    // delta in degrees longitude, corrected by latitude
    const deltaLon = (radDist * radToDeg) / Math.cos(latRad);

    const minLat = lat - deltaLat;
    const maxLat = lat + deltaLat;
    const minLon = lon - deltaLon;
    const maxLon = lon + deltaLon;

    return [minLon, minLat, maxLon, maxLat];
  }

  render() {
    return html`
      <nav class="navbar">
        <span class="app-title">Checkin</span>
        <sl-button
          id="logout-btn"
          variant="danger"
          size="small"
          @click=${this._logout}
          >Logout</sl-button
        >
      </nav>
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
          : html`<sl-spinner style='font-size: 2rem;'></sl-spinner>`}
      </div>
    `;
  }

  async _checkin(e) {
    const btn = e.currentTarget;
    const placeId = btn.dataset.placeId;
    const place = await this.toObject(placeId)
    const actor = await this.getActor()
    let activity = {
      actor: actor,
      type: "Arrive",
      location: place,
      to: "https://www.w3.org/ns/activitystreams#Public",
    }

    // makeSummary() returns a Template object. This renders it to
    // HTML to be sent across the wire

    activity.summaryMap = {
      en: render(this.makeSummary(activity))
    }
    activity = await this.doActivity(activity);

    // Go to the inbox
    const next = document.createElement('checkin-inbox');
    next.setAttribute('redirect-uri', this.redirectUri)
    next.setAttribute('client-id', this.cliendId)
    this.replaceWith(next)
  }

  _logout() {
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("expires_in");
    sessionStorage.removeItem("actor_id");
    window.location = this.redirectUri
  }
}

customElements.define("checkin-main", CheckinMainElement);
