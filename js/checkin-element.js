import { html, css, LitElement, unsafeHTML } from 'https://cdn.jsdelivr.net/gh/lit/dist@3/all/lit-all.min.js'

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
    let outbox = sessionStorage.getItem('outbox')
    if (!outbox) {
      const actor = await this.getActor()
      outbox = actor.outbox
      sessionStorage.setItem('outbox', outbox)
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
    const expires = parseInt(sessionStorage.getItem('expires'))
    if (Date.now() > expires) {
      const url = sessionStorage.getItem('oauth_token_url')
      const refresh_token = sessionStorage.getItem('refresh_token')
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
          sessionStorage.setItem('access_token', json.access_token)
        }
        if (json.refresh_token) {
          sessionStorage.setItem('refresh_token', json.refresh_token)
        }
        if (json.expires_in) {
          sessionStorage.setItem('expires_in', json.expires_in)
          sessionStorage.setItem(
            'expires',
            Date.now() + json.expires_in * 1000
          )
        }
      }
    }
  }

  async apFetch (url, options = {}) {
    await this.ensureFreshToken()
    const accessToken = sessionStorage.getItem('access_token')
    const actorId = sessionStorage.getItem('actor_id')
    if (URL.parse(url).origin == URL.parse(actorId).origin) {
      if (!options.headers) {
        options.headers = {}
      }
      options.headers.Authorization = `Bearer ${accessToken}`
      return await fetch(url, options)
    } else {
      const proxyUrl = sessionStorage.getItem('proxy_url')
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
    const actorJSON = sessionStorage.getItem('actor')
    if (actorJSON) {
      return JSON.parse(actorJSON)
    } else {
      const actorId = sessionStorage.getItem('actor_id')
      const res = await this.apFetch(actorId)
      if (!res.ok) {
        throw new Error('Failure fetching actor')
      }
      const actor = await res.json()
      sessionStorage.setItem('actor', JSON.stringify(actor))
      return actor
    }
  }

  async * items (coll) {
    const collection = await this.toObject(coll, { noCache: true })
    if (collection.items) {
      for (const item of collection.items) {
        yield await this.toObject(item)
      }
    } else if (collection.orderedItems) {
      for (const item of collection.orderedItems) {
        yield await this.toObject(item)
      }
    } else if (collection.first) {
      let pageId = await this.toId(collection.first)
      do {
        const page = await this.toObject(pageId, { noCache: true })
        if (page.items) {
          for (const item of page.items) {
            yield await this.toObject(item)
          }
        } else if (page.orderedItems) {
          for (const item of page.orderedItems) {
            yield await this.toObject(item)
          }
        }
        pageId = await this.toId(page.next)
      } while (pageId)
    }
  }

  async toId (item) {
    return (typeof item === 'string')
      ? item
      : (typeof item === 'object' && item.id && typeof item.id === 'string')
          ? item.id
          : null
  }

  async toObject (item, options = {}) {
    const { noCache } = options
    const id = await this.toId(item)
    let json
    if (!noCache) {
      const cached = sessionStorage.getItem(`cache:${id}`)
      if (cached) {
        try {
          const json = JSON.parse(cached)
          return json
        } catch (err) {
          sessionStorage.removeItem(`cache:${id}`)
          console.error(err)
        }
      }
    }
    try {
      const res = await this.apFetch(id)
      json = await res.json()
    } catch (err) {
      json = (typeof item === 'string')
        ? { id: item }
        : (typeof item === 'object' && Array.isArray(item) && item.length > 0)
            ? item[0]
            : (typeof item === 'object')
                ? item
                : null
    }
    if (!noCache) {
      sessionStorage.setItem(`cache:${id}`, JSON.stringify(json))
    }
    return json
  }

  getUrl (object) {
    if (!object) return null
    if (!(typeof object) == 'object') return null
    if (!(object.url)) return null
    switch (typeof object.url) {
      case 'string':
        return object.url
      case 'object':
        if (Array.isArray(object.url)) {
          const htmlLink = object.url.find(l => typeof l === 'object' && l.mediaType && l.mediaType.startsWith('text/html'))
          if (htmlLink) {
            return htmlLink.href
          } else if (object.url.length > 0) {
            return object.url[0].href
          } else {
            return null
          }
        } else {
          return object.url.href
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
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
  }

  makeSummaryPart (object, def = '(something)') {
    const name = (object)
      ? (object.name)
          ? object.name
          : def
      : def
    const url = this.getUrl(object)
    return (url)
      ? `<a href="${this.attrEscape(url)}">${this.contentEscape(name)}</a>`
      : `${this.contentEscape(name)}`
  }

  makeSummary (activity) {
    const actorPart = this.makeSummaryPart(activity.actor, '(someone)')
    switch (activity.type) {
      case 'Arrive': {
        const placePart = this.makeSummaryPart(activity.location, '(somewhere)')
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
