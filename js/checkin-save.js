import {
  html,
  css,
  LitElement
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'

import * as oauth from 'https://cdn.jsdelivr.net/npm/oauth4webapi@3/+esm'


export class CheckinSaveElement extends LitElement {
  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      successUri: { type: String, attribute: 'success-uri' },
      _error: { type: String, state: true }
    }
  }

  #authorizationServer
  #client
  #clientAuth
  #state
  #codeVerifier

  constructor () {
    super()
  }

  connectedCallback () {
    super.connectedCallback()
    this.handleLogin()
      .then(() => {
        window.location = this.redirectUri
      })
      .catch((err) => {
        this._error = err.message
      })
  }


  clearSession () {
    sessionStorage.removeItem('state')
    sessionStorage.removeItem('code_verifier')
  }

  saveResult (result) {
    sessionStorage.setItem('access_token', result.access_token)
    sessionStorage.setItem('refresh_token', result.refresh_token)
    sessionStorage.setItem('expires_in', result.expires_in)
    sessionStorage.setItem(
      'expires',
      Date.now() + result.expires_in * 1000
    )
  }

  async handleLogin () {

    const authorizationServer = {
      issuer: (new URL(sessionStorage.getItem('actor_id'))).origin,
      authorization_endpoint: sessionStorage.getItem('authorization_endpoint'),
      token_endpoint: sessionStorage.getItem('token_endpoint'),
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['read', 'write'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
    }
    const clientAuth = oauth.None()
    const client = {
      client_id: this.clientId
    }

    const state = sessionStorage.getItem('state')
    const codeVerifier = sessionStorage.getItem('code_verifier')

    try {

      const params = oauth.validateAuthResponse(
        authorizationServer,
        client,
        new URLSearchParams(window.location.search),
        state
      )


      const response = await oauth.authorizationCodeGrantRequest(
        authorizationServer,
        client,
        clientAuth,
        params,
        this.redirectUri,
        codeVerifier,
      )

      const result = await oauth.processAuthorizationCodeResponse(
        authorizationServer,
        client,
        response
      )

      this.saveResult(result)

      this.clearSession()

      window.location = this.successUri
    } catch (error) {
      this._error = error.message
    }
  }

  render () {
    return (this._error)
      ? html`<sl-alert>${this._error}</sl-alert>`
      : html`<sl-spinner style='font-size: 2rem;'></sl-spinner>`
  }
}

customElements.define('checkin-save', CheckinSaveElement)
