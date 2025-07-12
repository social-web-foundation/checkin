import {
  html,
  css,
  LitElement
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'

import { CheckinElement } from './checkin-element.js'
import { CheckinChoosePlaceElement } from './checkin-choose-place.js'
import { CheckinInboxElement } from './checkin-inbox.js'

export class CheckinHomeElement extends CheckinElement {
    static styles = css`
    :host {
      display: grid;
      grid-template-rows: auto 1fr auto;
      min-height: 100vh;
    }

    header,
    main,
    footer {
      width: 100%;
      max-width: var(--max-width);
      margin: 0 auto;
      padding: var(--gap);
    }

    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  `;

  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      _route: { type: String, state: true },
      _error: { type: String, state: true },
      _actor: { type: Object, state: true }
    }
  }

  constructor () {
    super()
    this._route = 'inbox'
  }

  connectedCallback () {
    super.connectedCallback()
    this.getActor()
      .then((actor) => {
        this._actor = actor
      })
      .catch((err) => {
        this._error = err.message
      })
    window.addEventListener('popstate', () => {
      const route = (window.location.hash)
        ? window.location.hash.replace('#', '')
        : 'inbox'
      if (route === 'logout') {
        this._logout()
      } else {
        this._route = route
      }
    })
  }

  render () {
    return html`

    <header>

      <span class="brand"><a href="#">Checkin</a></span>

      <sl-button href="#checkin" variant="primary">
        +
      </sl-button>

      <!-- User menu dropdown -->
      <sl-dropdown>
        <sl-button slot="trigger" caret>${(this._actor) ? this._actor.name : "User"}</sl-button>
        <sl-menu>
          <sl-menu-item href="#settings">Settings</sl-menu-item>
          <sl-menu-item href="#logout">Log out</sl-menu-item>
        </sl-menu>
      </sl-dropdown>
    </header>

    <main>
      ${(this._route === 'inbox')
        ? html`<checkin-inbox .redirect-uri=${this.redirectUri} .client-id=${this.clientId} />`
        : (this._route === 'checkin')
          ? html`<checkin-choose-place .redirect-uri=${this.redirectUri} .  client-id=${this.clientId} />`
          : html`<sl-alert>Unknown route</sl-alert>`
      }
    </main>

    <footer>
      <a href="https://github.com/social-web-foundation/checkin/">GitHub</a>
    </footer>
    `
  }

  _logout () {
    sessionStorage.clear()
    window.location = this.redirectUri
  }
}

customElements.define(
  'checkin-home',
  CheckinHomeElement
)
