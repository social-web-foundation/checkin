import {
  html,
  css,
  LitElement,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";


import { CheckinElement } from './checkin-element.js'
import { CheckinActivityElement } from './checkin-activity.js'

export class CheckinInboxElement extends CheckinElement {

  MAX_ACTIVITIES = 20
  MAX_TIME_WINDOW = 3 * 24 * 60 * 60 * 1000 // three days

  static get properties() {
    return {
      ...super.properties(),
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
      html`<checkin-activity .activity=${a}></checkin-activity>`
      )
    }
    </div>
    `
    : html`<sl-spinner style='font-size: 2rem;'></sl-spinner>`
  }

  async getActivities() {
    let inbox = sessionStorage.getItem("inbox");
    if (!inbox) {
      const actor = await this.getActor();
      inbox = actor.inbox;
      sessionStorage.setItem("inbox", inbox);
    }

    const activities = []

    for await (const activity of this.items(inbox)) {
      if (this.isGeo(activity)) {
        activities.push(activity)
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

  async isGeo(object) {
    return ['Arrive', 'Leave', 'Travel'].includes(object.type)
  }

  _startCheckin() {
    const next = document.createElement('checkin-main');
    next.setAttribute('redirect-uri', this.redirectUri)
    next.setAttribute('client-id', this.cliendId)
    this.replaceWith(next)
  }
}

customElements.define("checkin-inbox", CheckinInboxElement);
