import {
  html,
  css,
  LitElement,
  unsafeHTML
} from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js'

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

  async ensureFreshToken () {
    const expires = parseInt(localStorage.getItem('expires'))
    if (Date.now() > expires) {
      const url = localStorage.getItem('token_endpoint')
      const refresh_token = localStorage.getItem('refresh_token')
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token,
          client_id: this.clientId
        })
      })
      if (!res.ok) {
        console.error('Error')
      } else {
        const json = await res.json()
        if (json.access_token) {
          localStorage.setItem('access_token', json.access_token)
        }
        if (json.refresh_token) {
          localStorage.setItem('refresh_token', json.refresh_token)
        }
        if (json.expires_in) {
          localStorage.setItem('expires_in', json.expires_in)
          localStorage.setItem(
            'expires',
            Date.now() + json.expires_in * 1000
          )
        }
      }
    }
  }

  async apFetch (url, options = {}) {
    await this.ensureFreshToken()
    const accessToken = localStorage.getItem('access_token')
    const actorId = localStorage.getItem('actor_id')
    if (URL.parse(url).origin == URL.parse(actorId).origin) {
      if (!options.headers) {
        options.headers = {}
      }
      options.headers.Authorization = `Bearer ${accessToken}`
      return await fetch(url, options)
    } else {
      const proxyUrl = localStorage.getItem('proxy_url')
      return await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Bearer ${accessToken}`
        },
        body: new URLSearchParams({
          id: url
        })
      })
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
