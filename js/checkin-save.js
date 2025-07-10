import {
  html,
  css,
  LitElement,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";

export class CheckinSaveElement extends LitElement {

  static get properties() {
    return {
      redirectUri: { type: String, attribute: "redirect-uri" },
      clientId: { type: String, attribute: "client-id" },
      _error: { type: String, state: true },
    };
  }

  constructor() {
    super();
  }

  connectedCallback() {
    super.connectedCallback();
    this.handleLogin()
    .then(() => {
      window.location = redirect_uri
    })
    .catch((err) => {
      this._error = err.message
    })
  }

  async handleLogin() {
    const params = new URLSearchParams(window.location.search);
    const savedState = sessionStorage.getItem("oauth_state");
    sessionStorage.removeItem("oauth_state");
    if (params.get("state") !== savedState) {
      throw new Error("Bad state");
    }
    if (params.get("error")) {
      throw new Error(params.get("error"));
    }
    if (params.get("code")) {
      const code = params.get("code");
      const url = sessionStorage.getItem("oauth_token_url");
      const code_verifier = sessionStorage.getItem("oauth_pkce_verifier");
      sessionStorage.removeItem("oauth_pkce_verifier");
      const tp = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        code_verifier,
      });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: tp,
      });
      if (!res.ok) {
        throw new Error("Error");
      } else {
        const json = await res.json();
        sessionStorage.setItem("access_token", json.access_token);
        sessionStorage.setItem("refresh_token", json.refresh_token);
        sessionStorage.setItem("expires_in", json.expires_in);
        sessionStorage.setItem(
          "expires",
          Date.now() + json.expires_in * 1000
        );
        window.location = this.redirectUri
      }
    }
  }

  render() {
    return html`<sl-spinner style='font-size: 2rem;'></sl-spinner>`
  }
}


customElements.define("checkin-save", CheckinSaveElement);