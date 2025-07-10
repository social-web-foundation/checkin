import {
  html,
  css,
  LitElement,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";

import { CheckinElement } from './checkin-element.js'

export class CheckinMainElement extends CheckinElement {

  static get properties() {
    return {
      ...super.properties(),
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

  async doActivity(obj) {
    let outbox = sessionStorage.getItem("outbox");
    if (!outbox) {
      const actor = await this.getActor();
      outbox = actor.outbox;
      sessionStorage.setItem("outbox", outbox);
    }
    await this.apFetch(outbox, {
      method: "POST",
      headers: {
        "Content-Type": "application/activity+json",
      },
      body: JSON.stringify({
        "@context": "https://www.w3.org/ns/activitystreams",
        ...obj,
      }),
    });
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
    const placeName = btn.dataset.placeName;
    const actor = await this.getActor()
    await this.doActivity({
      type: "Arrive",
      location: placeId,
      summaryMap: {
        en: `${actor.name} arrived at ${placeName}`,
      },
      to: "https://www.w3.org/ns/activitystreams#Public",
    });
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

  async ensureFreshToken() {
    const expires = parseInt(sessionStorage.getItem("expires"));
    if (Date.now() > expires) {
      const url = sessionStorage.getItem("oauth_token_url");
      const refresh_token = sessionStorage.getItem("refresh_token");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token,
          client_id: this.clientId
        }),
      });
      if (!res.ok) {
        console.error("Error");
      } else {
        const json = await res.json();
        if (json.access_token) {
          sessionStorage.setItem("access_token", json.access_token);
        }
        if (json.refresh_token) {
          sessionStorage.setItem("refresh_token", json.refresh_token);
        }
        if (json.expires_in) {
          sessionStorage.setItem("expires_in", json.expires_in);
          sessionStorage.setItem(
            "expires",
            Date.now() + json.expires_in * 1000
          );
        }
      }
    }
  }

  async apFetch(url, options = {}) {
    await this.ensureFreshToken();
    const accessToken = sessionStorage.getItem("access_token");
    const actorId = sessionStorage.getItem("actor_id");
    if (URL.parse(url).origin == URL.parse(actorId).origin) {
      if (!options.headers) {
        options.headers = {};
      }
      options.headers["Authorization"] = `Bearer ${accessToken}`;
      return await fetch(url, options);
    } else {
      const proxyUrl = sessionStorage.getItem("proxy_url");
      return await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Bearer ${accessToken}`
        },
        body: new URLSearchParams({
          id: url,
        }),
      });
    }
  }

  async getActor() {
    const actorId = sessionStorage.getItem("actor_id")
    const res = await this.apFetch(actorId);
    if (!res.ok) {
      throw new Error("Failure fetching actor");
    }
    return await res.json();
  }
}

customElements.define("checkin-main", CheckinMainElement);
