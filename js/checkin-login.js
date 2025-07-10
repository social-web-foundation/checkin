import {
  html,
  css,
  LitElement,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";

class CheckinLoginElement extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

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
  }

  render() {
    return html`
      <div style="display: flex; flex-direction: column; align-items: center;">
        <h1
          style="margin-bottom: 1.5em; font-size: 2.2em; font-weight: 700; color: #222; letter-spacing: 0.02em;"
        >
          Checkin
        </h1>
        <div
          id="error-container"
          style="width: 100%; max-width: 60ch; margin-bottom: 1em;"
        >
          ${this._error}
        </div>
        <div class="login-container">
          <sl-input
            id="webfinger"
            label="Webfinger ID"
            placeholder="user@example.com"
            style="flex:1;"
          ></sl-input>
          <sl-button
            @click=${this.login()}
            id="login-btn"
            variant="primary">
            Login
          </sl-button>
        </div>
      </div>
    `;
  }

  async getActorId(id) {
    const re =
      /^(?:acct:)?(?<username>[^@]+)@(?<domain>(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(?:\.(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?))*)$/;
    const m = re.exec(id);
    if (!m) {
      throw new Error("bad Webfinger format");
    }
    const username = m.groups.username;
    const domain = m.groups.domain;
    const wfUrl = `https://${domain}/.well-known/webfinger?resource=acct:${username}%40${domain}`;
    const res = await fetch(wfUrl);
    if (!res.ok) {
      throw new Error("Could not load webfinger");
    }
    const json = await res.json();
    if (!json.links) {
      throw new Error("No links in webfinger json");
    }
    const actorLink = json.links.find(
      (obj) =>
        obj.rel == "self" &&
        [
          "application/activity+json",
          'application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
        ].includes(obj.type)
    );
    if (!actorLink) {
      throw new Error("No ActivityPub actor ID in Webfinger");
    }
    return actorLink.href;
  }

  async getActor(actorId) {
    const res = await fetch(actorId);
    if (!res.ok) {
      throw new Error("Failure fetching actor");
    }
    return await res.json();
  }

  async getAuthorizationEndpoint(actor) {
    return actor.endpoints?.oauthAuthorizationEndpoint;
  }

  async getTokenEndpoint(actor) {
    return actor.endpoints?.oauthTokenEndpoint;
  }

  async getProxyUrl(actor) {
    return actor.endpoints?.proxyUrl;
  }

  generateCodeVerifier(length = 64) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  async generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  base64UrlEncode(buffer) {
    const b64 = btoa(String.fromCharCode(...buffer));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  async login() {
    const id = webfingerInput.value.trim();
    if (!id) {
      this._error = "Please enter your Webfinger ID.";
      return;
    }
    try {
      const actorId = await this.getActorId(id);
      sessionStorage.setItem("actor_id", actorId);
      const actor = await this.getActor(actorId);
      const tokenUrl = await this.getTokenEndpoint(actor);
      sessionStorage.setItem("oauth_token_url", tokenUrl);
      const proxyUrl = await this.getProxyUrl(actor);
      sessionStorage.setItem("proxy_url", proxyUrl);
      const authorizationUrl = await this.getAuthorizationEndpoint(actor);
      const state = crypto.randomUUID();
      sessionStorage.setItem("oauth_state", state);
      const verifier = this.generateCodeVerifier();
      sessionStorage.setItem("oauth_pkce_verifier", verifier);
      const challenge = await this.generateCodeChallenge(verifier);
      const params = new URLSearchParams({
        response_type: "code",
        client_id: this.clientId,
        redirect_uri: this.redirectUri,
        scope: "read write",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
      });
      window.location = `${authorizationUrl}?${params}`;
    } catch (error) {
      this._error = error.message;
    }
  }
}

customElements.define("checkin-login", CheckinLoginElement);
