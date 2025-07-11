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
        ? unsafeHTML(DOMPurify.sanitize(this.activity.summary))
          : (this.activity.summaryMap?.en)
            ? unsafeHTML(DOMPurify.sanitize(this.activity.summaryMap?.en))
            : unsafeHTML(this.makeSummary(this.activity))
      }
      </p>
      <p>
      ${this.activity.published}
      </p>
      </div>
    `
  }
}

customElements.define("checkin-activity", CheckinActivityElement);
