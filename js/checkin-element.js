import {
  html,
  css,
  LitElement,
  unsafeHTML
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js'

import * as oauth from 'https://cdn.jsdelivr.net/npm/oauth4webapi@3/+esm'

export class CheckinElement extends LitElement {
  static get properties () {
    return {
      redirectUri: { type: String, attribute: 'redirect-uri' },
      clientId: { type: String, attribute: 'client-id' }
    }
  }

  constructor () {
    super()
  }

  async doActivity (obj) {
    let outbox = localStorage.getItem('outbox')
    if (!outbox) {
      const actor = await this.getActor()
      outbox = actor.outbox
      localStorage.setItem('outbox', outbox)
    }
    const res = await this.apFetch(outbox, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/activity+json'
      },
      body: JSON.stringify({
        '@context': 'https://www.w3.org/ns/activitystreams',
        ...obj
      })
    })
    return await res.json()
  }

  saveResult (result) {
    localStorage.setItem('access_token', result.access_token)
    localStorage.setItem('refresh_token', result.refresh_token)
    localStorage.setItem('expires_in', result.expires_in)
    localStorage.setItem(
      'expires',
      Date.now() + result.expires_in * 1000
    )
  }

  async ensureFreshToken () {
    const expires = parseInt(localStorage.getItem('expires'))
    if (Date.now() > expires) {
      const authorizationServer = {
        issuer: (new URL(localStorage.getItem('actor_id'))).origin,
        authorization_endpoint: localStorage.getItem('authorization_endpoint'),
        token_endpoint: localStorage.getItem('token_endpoint'),
        code_challenge_methods_supported: ['S256'],
        scopes_supported: ['read', 'write'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token']
      }
      const clientAuth = oauth.None()
      const client = {
        client_id: this.clientId
      }
      const refreshToken = localStorage.getItem('refresh_token')
      try {
        const response = await oauth.refreshTokenGrantRequest(
          authorizationServer,
          client,
          clientAuth,
          refreshToken
        )
        const result = await oauth.processRefreshTokenResponse(
          authorizationServer,
          client,
          response
        )
        this.saveResult(result)
      } catch (error) {
        console.error(error)
      }
    }
  }

  async apFetch (url, options = {}) {
    await this.ensureFreshToken()
    const accessToken = localStorage.getItem('access_token')
    const actorId = localStorage.getItem('actor_id')
    const urlObj = (typeof url === 'string')
      ? new URL(url)
      : url
    if (urlObj.origin == URL.parse(actorId).origin) {
      return await oauth.protectedResourceRequest(
        accessToken,
        options.method || 'GET',
        urlObj,
        options.headers,
        options.body
      )
    } else {
      const proxyUrl = localStorage.getItem('proxy_url')
      return await oauth.protectedResourceRequest(
        accessToken,
        'POST',
        proxyUrl,
        {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        new URLSearchParams({
          id: urlObj.toString()
        })
      )
    }
  }

  async getActor () {
    const actorJSON = localStorage.getItem('actor')
    if (actorJSON) {
      return JSON.parse(actorJSON)
    } else {
      const actorId = localStorage.getItem('actor_id')
      const res = await this.apFetch(actorId, {
        headers: {
          Accept:
            'application/activity+json,application/lrd+json,application/json'
        }
      })
      if (!res.ok) {
        throw new Error('Failure fetching actor')
      }
      const actor = await res.json()
      localStorage.setItem('actor', JSON.stringify(actor))
      return actor
    }
  }

  async _getAllItems (arr) {
    return await Promise.all(
      arr.map((i) =>
        this.toObject(i, { required: ['id', 'type', 'published'] })
      )
    )
  }

  async * items (coll) {
    const collection = await this.toObject(coll, { noCache: true })
    if (collection.items) {
      const objects = await this._getAllItems(collection.items)
      for (const object of objects) {
        yield object
      }
    } else if (collection.orderedItems) {
      const objects = await this._getAllItems(collection.orderedItems)
      for (const object of objects) {
        yield object
      }
    } else if (collection.first) {
      let pageId = await this.toId(collection.first)
      do {
        const page = await this.toObject(pageId, { noCache: true })
        if (page.items) {
          const objects = await this._getAllItems(page.items)
          for (const object of objects) {
            yield object
          }
        } else if (page.orderedItems) {
          const objects = await this._getAllItems(page.orderedItems)
          for (const object of objects) {
            yield object
          }
        }
        pageId = await this.toId(page.next)
      } while (pageId)
    }
  }

  async toId (item) {
    return typeof item === 'string'
      ? item
      : typeof item === 'object' && item.id && typeof item.id === 'string'
        ? item.id
        : null
  }

  async toObject (item, options = { noCache: false, required: null }) {
    const { noCache, required } = options
    if (
      required &&
      typeof item === 'object' &&
      required.every((p) => p in item)
    ) {
      return item
    }
    const id = await this.toId(item)
    let json
    if (!noCache) {
      const cached = localStorage.getItem(`cache:${id}`)
      if (cached) {
        try {
          const json = JSON.parse(cached)
          return json
        } catch (err) {
          localStorage.removeItem(`cache:${id}`)
          console.error(err)
        }
      }
    }
    try {
      const res = await this.apFetch(id, {
        headers: {
          Accept:
            'application/activity+json,application/lrd+json,application/json'
        }
      })
      json = await res.json()
    } catch (err) {
      json =
        typeof item === 'string'
          ? { id: item }
          : typeof item === 'object' && Array.isArray(item) && item.length > 0
            ? item[0]
            : typeof item === 'object'
              ? item
              : null
    }
    if (!noCache) {
      localStorage.setItem(`cache:${id}`, JSON.stringify(json))
    }
    return json
  }

  getIcon (object) {
    return this.getUrl(object, {
      prop: 'icon',
      types: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/svg+xml',
        'image/webp',
        'image/avif',
        'image/vnd.microsoft.icon'
      ]
    })
  }

  getUrl (object, options = { prop: 'url', types: ['text/html'] }) {
    const { prop, types } = options
    if (!object) return null
    if (!typeof object == 'object') return null
    if (!object[prop]) return null
    switch (typeof object[prop]) {
      case 'string':
        return object[prop]
      case 'object':
        if (Array.isArray(object[prop])) {
          const linkMatch = object[prop].find(
            (l) =>
              typeof l === 'object' &&
              l.type === 'Link' &&
              l.mediaType &&
              types.some((t) => l.mediaType.startsWith(t))
          )
          if (linkMatch) {
            return linkMatch.href
          } else if (object[prop].length > 0) {
            return object[prop][0].href
          } else {
            return null
          }
        } else {
          return object[prop].href
        }
        break
    }
  }

  attrEscape (s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  contentEscape (s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  makeSummaryPart (object, def = '(something)') {
    const name = object ? (object.name ? object.name : def) : def
    const url = this.getUrl(object)
    return url
      ? `<a href="${this.attrEscape(url)}">${this.contentEscape(name)}</a>`
      : `${this.contentEscape(name)}`
  }

  makeSummary (activity) {
    const actorPart = this.makeSummaryPart(activity.actor, '(someone)')
    switch (activity.type) {
      case 'Arrive': {
        const placePart = this.makeSummaryPart(
          activity.location,
          '(somewhere)'
        )
        return `${actorPart} arrived at ${placePart}`
        break
      }
      case 'Leave': {
        const placePart = this.makeSummaryPart(activity.object, '(somewhere)')
        return `${actorPart} left ${placePart}`
        break
      }
      case 'Travel': {
        const targetPart = this.makeSummaryPart(activity.target, '(somewhere)')
        const originPart = this.makeSummaryPart(activity.origin, '(somewhere)')
        return `${actorPart} travelled from ${originPart} to ${targetPart}`
        break
      }
      default: {
        return '(Unknown activity)'
      }
    }
  }
}
