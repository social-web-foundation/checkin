import {
  html,
  css,
  LitElement
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js'

import oauth from 'https://cdn.jsdelivr.net/npm/oauth4webapi@3.7.0/+esm'

export class CheckinSaveElement extends LitElement {
  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' },
      successUri: { type: String, attribute: 'success-uri' },
      _error: { type: String, state: true }
    }
  }

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

  async handleLogin () {
    const params = new URLSearchParams(window.location.search)
    const savedState = sessionStorage.getItem('oauth_state')
    sessionStorage.removeItem('oauth_state')
    if (params.get('state') !== savedState) {
      throw new Error('Bad state')
    } else {
      const error = params.get("error");
      const error_description = params.get("error_description")
      if (error) {
        switch (error) {
          case "invalid_request":
            throw new Error((error_description)
              ? `Invalid request: ${error_description}`
              : 'Invalid request'
            );
            break;
          case "access_denied":
            throw new Error((error_description)
              ? `Access denied: ${error_description}`
              : 'Access denied.'
            );
            break;
          case "unauthorized_client":
            throw new Error(`Unauthorized client.`);
            break;
          case "unsupported_response_type":
            throw new Error(`Unsupported response_type parameter.`);
            break;
          case "invalid_scope":
            throw new Error(`Invalid scope parameter.`);
            break;
          case "server_error":
            throw new Error((error_description)
              ? `The server had an error: ${error_description}`
              : 'The server had an error.'
            );
            break;
          case "temporarily_unavailable":
            throw new Error(
              `The server is temporarily unavailable.`
            );
            break;
        }
      } else {
        const code = params.get("code");
        const code_verifier = sessionStorage.getItem('code_verifier');
        const tokenUrl = sessionStorage.getItem('oauth_token_url')
        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            client_id: this.clientId,
            redirect_uri: this.redirectUri,
            code_verifier,
          }),
        });
        const result = await response.json();
        sessionStorage.setItem('access_token', result.access_token)
        sessionStorage.setItem('refresh_token', result.refresh_token)
        sessionStorage.setItem('expires_in', result.expires_in)
        sessionStorage.setItem(
          'expires',
          Date.now() + result.expires_in * 1000
        )
        window.location = this.successUri
      }
    }
  }

  render () {
    return html`<sl-spinner style='font-size: 2rem;'></sl-spinner>`
  }
}

customElements.define('checkin-save', CheckinSaveElement)
