import {
  html,
  css,
  unsafeHTML
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js'
import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify@3.2.3/+esm'
import { CheckinElement } from './checkin-element.js'

export class CheckinActivityElement extends CheckinElement {
  static styles = css`
    :host {
      display: block;
      height: 100%;
    }

    sl-card {
      width: 100%;
      height: 100%;
      --card-padding: 0.5rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--sl-color-neutral-200);
    }

    .card-body {
      padding: var(--card-padding) 0;
      flex: 1;
    }

    .card-footer {
      font-size: 0.875rem;
      color: var(--sl-color-neutral-600);
      text-align: right;
      padding-top: 0.5rem;
      border-top: 1px solid var(--sl-color-neutral-200);
    }

    sl-avatar {
      --size: 2rem;
    }

    /* ensure relative-time fits */
    sl-relative-time {
      font-size: inherit;
    }
  `

  static get properties () {
    return {
      activity: { type: Object },
      _error: { type: String, state: true },
      _actor: { type: Object, state: true },
      _location: { type: Object, state: true },
      _target: { type: Object, state: true },
      _origin: { type: Object, state: true }
    }
  }

  constructor() {
    super()
    this._actor = this.activity?.actor
    this._location = this.activity._location
    this._target = this.activity._target
    this._origin = this.activity._origin
  }


  connectedCallback () {
    super.connectedCallback()
    Promise.all([
      this._loadActor(),
      this._loadLocation(),
      this._loadTarget(),
      this._loadOrigin()
    ]).then(() => {
      console.log("Parts loaded")
    })
  }

  async _loadActor() {
    if (this.activity.actor) {
      this._actor = await this.getObject(this.activity.actor)
    }
  }

  async _loadLocation() {
    if (this.activity.location) {
      this._location = await this.getObject(this.activity.location)
    }
  }

  async _loadTarget() {
    if (this.activity.target) {
      this._target = await this.getObject(this.activity.target)
    }
  }

  async _loadOrigin() {
    if (this.activity.origin) {
      this._origin = await this.getObject(this.activity.origin)
    }
  }

  render () {

    return html`
      <sl-card>
        <div slot="header" class="card-header">
          <sl-avatar
            image="${this.getIcon(this._actor)}"
            label="${this._actor?.name}"
          ></sl-avatar>
          <span>${this._actor?.name}</span>
        </div>

        <div class="card-body">
          <p>
            ${this.activity.summary
              ? unsafeHTML(DOMPurify.sanitize(this.activity.summary))
              : this.activity.summaryMap?.en
              ? unsafeHTML(DOMPurify.sanitize(this.activity.summaryMap.en))
              : unsafeHTML(this.makeSummary(this.activity))}
          </p>
        </div>

        <div slot="footer" class="card-footer">
          <sl-relative-time datetime="${this.activity.published}"></sl-relative-time>
        </div>
      </sl-card>
    `
  }
}

customElements.define('checkin-activity', CheckinActivityElement)
