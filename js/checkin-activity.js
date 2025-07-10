import { html, css, LitElement, unsafeHTML } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js';

export class CheckinActivityElement extends LitElement {

  static styles = css`
    .checkin-activity {
      border: 1px
    }
  `

  static get properties() {
    return {
      activity: { type: Object },
      _error: { type: String, state: true },
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
        ? unsafeHTML`${this.activity.summary}`
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
    const actorName = this.activity.actor?.actor
    switch (this.activity.type) {
      case "Arrive": {
        const place = this.activity.location
        const placeName = place?.name
        return html`${actorName} arrived at ${placeName}`
        break;
      }
      case "Leave": {
        const place = this.activity.object
        const placeName = place?.name
        return html`${actorName} left ${placeName}`
        break;
      }
      case "Travel": {
        const target = this.activity.target
        const origin = this.activity.origin
        const targetName = target?.name
        const originName = origin?.name
        return html`${actorName} travelled from ${originName} to ${targetName}`
        break;
      }
      default: {
        return html`(Unknown activity)`
      }
    }
  }
}

customElements.define("checkin-activity", CheckinActivityElement);
