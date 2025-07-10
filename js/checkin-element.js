import {
  html,
  css,
  LitElement,
} from "https://cdn.jsdelivr.net/gh/lit/dist@3/core/lit-core.min.js";

export class CheckinElement extends LitElement {

  static get properties() {
    return {
      redirectUri: { type: String, attribute: "redirect-uri" },
      clientId: { type: String, attribute: "client-id" }
    };
  }

  constructor() {
    super();
  }

  async doActivity(obj) {
    let outbox = sessionStorage.getItem("outbox");
    if (!outbox) {
      const actor = await this.getActor();
      outbox = actor.outbox;
      sessionStorage.setItem("outbox", outbox);
    }
    await this.apFetch(outbox, {
      method: "POST",
      headers: {
        "Content-Type": "application/activity+json",
      },
      body: JSON.stringify({
        "@context": "https://www.w3.org/ns/activitystreams",
        ...obj,
      }),
    });
  }

  async ensureFreshToken() {
    const expires = parseInt(sessionStorage.getItem("expires"));
    if (Date.now() > expires) {
      const url = sessionStorage.getItem("oauth_token_url");
      const refresh_token = sessionStorage.getItem("refresh_token");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token,
          client_id: this.clientId
        }),
      });
      if (!res.ok) {
        console.error("Error");
      } else {
        const json = await res.json();
        if (json.access_token) {
          sessionStorage.setItem("access_token", json.access_token);
        }
        if (json.refresh_token) {
          sessionStorage.setItem("refresh_token", json.refresh_token);
        }
        if (json.expires_in) {
          sessionStorage.setItem("expires_in", json.expires_in);
          sessionStorage.setItem(
            "expires",
            Date.now() + json.expires_in * 1000
          );
        }
      }
    }
  }

  async apFetch(url, options = {}) {
    await this.ensureFreshToken();
    const accessToken = sessionStorage.getItem("access_token");
    const actorId = sessionStorage.getItem("actor_id");
    if (URL.parse(url).origin == URL.parse(actorId).origin) {
      if (!options.headers) {
        options.headers = {};
      }
      options.headers["Authorization"] = `Bearer ${accessToken}`;
      return await fetch(url, options);
    } else {
      const proxyUrl = sessionStorage.getItem("proxy_url");
      return await fetch(proxyUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Bearer ${accessToken}`
        },
        body: new URLSearchParams({
          id: url,
        }),
      });
    }
  }

  async getActor() {
    const actorId = sessionStorage.getItem("actor_id")
    const res = await this.apFetch(actorId);
    if (!res.ok) {
      throw new Error("Failure fetching actor");
    }
    return await res.json();
  }
}
