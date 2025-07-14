import {
  html,
  css,
  LitElement
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'

import { CheckinElement } from './checkin-element.js'

export class CheckinLoginElement extends LitElement {
  WEBFINGER_REGEXP =
    /^(?:acct:)?(?<username>[^@]+)@(?<domain>(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*)$/

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      height: 100vh;
      padding: 1rem;
      box-sizing: border-box;
      background: var(--bg-main, #fafafa);
    }
    .intro {
      font-size: 1.25rem;
      text-align: center;
      margin-bottom: 1.5rem;
      max-width: 30ch;
    }
    .login-form {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
    sl-input {
      flex: 1;
      --sl-input-width: 15rem;
    }
    sl-button {
      white-space: nowrap;
    }
  `

  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      _webfinger: { type: String, state: true },
      _error: { type: String, state: true }
    }
  }

  constructor () {
    super()
  }

  connectedCallback () {
    super.connectedCallback()
  }

  render () {
    return html`
      <h1>Checkin</h1>
      <p class="intro">
        Welcome! This is an <a href="https://activitypub.rocks/">ActivityPub</a>
        geosocial Web application. To log in, you need to have an account on a
        compatible server.
      </p>
      <div class="login-form">
        <sl-input
          id="webfinger"
          placeholder="username@example.com"
          @input=${this._input}
        ></sl-input>
        <sl-button
          variant="primary"
          ?disabled=${!this.isWebfinger(this._webfinger)}
          @click=${this._login}
        >
          Log In
        </sl-button>
        ${this._error ? html`<sl-alert>${this._error}</sl-alert>` : html``}
      </div>
    `
  }

  _input (e) {
    this._webfinger = e.target.value
  }

  isWebfinger (str) {
    return this.WEBFINGER_REGEXP.test(str)
  }

  async getActorId (id) {
    const m = this.WEBFINGER_REGEXP.exec(id)
    if (!m) {
      throw new Error('bad Webfinger format')
    }
    const username = m.groups.username
    const domain = m.groups.domain
    const wfUrl = `https://${domain}/.well-known/webfinger?resource=acct:${username}%40${domain}`
    const res = await fetch(wfUrl, {
      headers: {
        Accept: 'application/jrd+json,application/json'
      }
    })
    if (!res.ok) {
      throw new Error('Could not load webfinger')
    }
    const json = await res.json()
    if (!json.links) {
      throw new Error('No links in webfinger json')
    }
    const actorLink = json.links.find(
      (obj) =>
        obj.rel == 'self' &&
        [
          'application/activity+json',
          'application/ld+json; profile="https://www.w3.org/ns/activitystreams"'
        ].includes(obj.type)
    )
    if (!actorLink) {
      throw new Error('No ActivityPub actor ID in Webfinger')
    }
    return actorLink.href
  }

  async getActor (actorId) {
    const res = await fetch(actorId, {
      headers: {
        Accept:
          'application/activity+json,application/lrd+json,application/json'
      }
    })
    if (!res.ok) {
      throw new Error('Failure fetching actor')
    }
    return await res.json()
  }

  async getAuthorizationEndpoint (actor) {
    return actor.endpoints?.oauthAuthorizationEndpoint
  }

  async getTokenEndpoint (actor) {
    return actor.endpoints?.oauthTokenEndpoint
  }

  async getProxyUrl (actor) {
    return actor.endpoints?.proxyUrl
  }

  generateCodeVerifier (length = 64) {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return this.base64UrlEncode(array)
  }

  async generateCodeChallenge (verifier) {
    const encoder = new TextEncoder()
    const data = encoder.encode(verifier)
    const digest = await crypto.subtle.digest('SHA-256', data)
    return this.base64UrlEncode(new Uint8Array(digest))
  }

  base64UrlEncode (buffer) {
    const b64 = btoa(String.fromCharCode(...buffer))
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  async _login () {
    const webfingerInput = this.shadowRoot.querySelector('#webfinger')
    const id = webfingerInput.value.trim()
    if (!id) {
      this._error = 'Please enter your Webfinger ID.'
      return
    }
    try {
      const actorId = await this.getActorId(id)
      sessionStorage.setItem('actor_id', actorId)
      const actor = await this.getActor(actorId)
      const tokenUrl = await this.getTokenEndpoint(actor)
      if (!tokenUrl) {
        throw new Error(`No OAuth token endpoint.`)
      }
      sessionStorage.setItem('oauth_token_url', tokenUrl)
      const proxyUrl = await this.getProxyUrl(actor)
      if (!proxyUrl) {
        throw new Error(`No Proxy endpoint.`)
      }
      sessionStorage.setItem('proxy_url', proxyUrl)
      const authorizationUrl = await this.getAuthorizationEndpoint(actor)
      if (!authorizationUrl) {
        throw new Error(`No OAuth authorization endpoint.`)
      }
      const state = crypto.randomUUID()
      sessionStorage.setItem('oauth_state', state)
      const verifier = this.generateCodeVerifier()
      sessionStorage.setItem('oauth_pkce_verifier', verifier)
      const challenge = await this.generateCodeChallenge(verifier)
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        scope: 'read write',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256'
      })
      window.location = `${authorizationUrl}?${params}`
    } catch (error) {
      this._error = error.message
    }
  }
}

customElements.define('checkin-login', CheckinLoginElement)
