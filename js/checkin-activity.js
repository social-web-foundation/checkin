import { html, css, LitElement, unsafeHTML } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.2.3/+esm';

import { CheckinElement } from './checkin-element.js'

export class CheckinActivityElement extends CheckinElement {

  static styles = css`
    .checkin-activity {
      border: 1px
    }
  `

  static get properties() {
    return {
      activity: { type: Object },
      _error: { type: String, state: true },
      _actor: { type: Object, state: true },
      _location: { type: Object, state: true },
      _target: { type: Object, state: true },
      _origin: { type: Object, state: true }
    };
  }

  constructor() {
    super();
  }

  render() {
    return html`
      <div class="checkin-activity">
      <p>
      ${
        (this.activity.summary)
        ? unsafeHTML(DOMPurify(this.activity.summary))
          : (this.activity.summaryMap?.en)
            ? unsafeHTML(DOMPurify(this.activity.summaryMap.en))
            : this.makeSummary()
      }
      </p>
      <p>
      ${this.activity.published}
      </p>
      </div>
    `
  }

  makeSummary() {
    const actorName = this._actor?.name || "(someone)"
    switch (this.activity.type) {
      case "Arrive": {
        const place = this._location
        const placeName = place?.name || "(somewhere)"
        return html`${actorName} arrived at ${placeName}`
        break;
      }
      case "Leave": {
        const place = this._object
        const placeName = place?.name || "(somewhere)"
        return html`${actorName} left ${placeName}`
        break;
      }
      case "Travel": {
        const target = this._target
        const origin = this._origin
        const targetName = target?.name || "(somewhere)"
        const originName = origin?.name || "(somewhere)"
        return html`${actorName} travelled from ${originName} to ${targetName}`
        break;
      }
      default: {
        return html`(Unknown activity)`
      }
    }
  }

  updated(changedProperties) {
    super.updated(changedProperties);
    if (changedProperties.has('activity')) {
      const activity = changedProperties.get('activity')
      if (activity.actor) {
        this.toObject(activity.actor).then(o => this._actor = o)
      }
      if (activity.location) {
        this.toObject(activity.location).then(o => this._location = o)
      }
      if (activity.origin) {
        this.toObject(activity.origin).then(o => this._origin = o)
      }
      if (activity.target) {
        this.toObject(activity.target).then(o => this._target = o)
      }
    }
  }
}

customElements.define("checkin-activity", CheckinActivityElement);
