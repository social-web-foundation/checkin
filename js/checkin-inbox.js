import {
  html,
  css,
  LitElement,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";

import { CheckinActivityElement } from './checkin-activity.js'

export class CheckinInboxElement extends LitElement {

  MAX_ACTIVITIES = 20
  MAX_TIME_WINDOW = 3 * 24 * 60 * 60 * 1000 // three days

  static get properties() {
    return {
      redirectUri: { type: String, attribute: "redirect-uri" },
      clientId: { type: String, attribute: "client-id" },
      _error: { type: String, state: true },
      _activities: { type: Array, state: true }
    };
  }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this
      .getActivities()
      .catch((err) => this._error = err.message)
  }

  render() {
    return (this._activities)
    ? html`
    <sl-button @click=${this._startCheckin.bind(this)}>Checkin</sl-button>
    <div class="inbox-activities">
    ${this._activities.map(a =>
      html`<checkin-activity activity=${a}></checkin-activity>`
      )
    }
    </div>
    `
    : html`<sl-spinner style='font-size: 2rem;'></sl-spinner>`
  }

  async getActivities() {
    let inbox = sessionStorage.getItem("inbox");
    if (!outbox) {
      const actor = await this.getActor();
      outbox = actor.outbox;
      sessionStorage.setItem("inbox", outbox);
    }

    const activities = []

    for await (const activity of this.items(inbox)) {
      if (this.isGeo(activity)) {
        activities.append(activity)
      }
      if (activities.length >= this.MAX_ACTIVITIES) {
        break;
      }
      if ((new Date(activity.published)).getTime() <= Date.now() - this.MAX_TIME_WINDOW) {
        break;
      }
    }

    this._activities = activities
  }

  async *items(coll) {
    const collection = await this.toObject(coll)
    if (collection.items) {
      for (const item in collection.items) {
        yield await this.toObject(item)
      }
    } else if (collection.orderedItems) {
      for (const item in collection.orderedItems) {
        yield await this.toObject(item)
      }
    } else if (collection.first) {
      let pageId = await this.toId(collection.first)
      do {
        const page = await this.toObject(pageId)
        if (page.items) {
          for (const item in collection.items) {
            yield await this.toObject(item)
          }
        } else if (page.orderedItems) {
          for (const item in collection.orderedItems) {
            yield await this.toObject(item)
          }
        }
        pageId = await this.toId(page.next)
      } while (pageId)
    }
  }

  async toId(item) {
    return (typeof item == 'string')
          ? item
          : (typeof item == 'object' && item.id && typeof item.id == 'string')
            ? item.id
            : null
  }

  async toObject(item) {
    const id = await this.toId(item)
    const res = await this.apFetch(id)
    return await res.json()
  }

  async isGeo(object) {
    return ['Arrive', 'Leave', 'Travel'].includes(object.type)
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
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
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

  _startCheckin() {
    const next = document.createElement('checkin-main');
    next.setAttribute('redirect-uri', this.redirectUri)
    next.setAttribute('client-id', this.cliendId)
    this.replaceWith(next)
  }
}

customElements.define("checkin-inbox", CheckinInboxElement);
