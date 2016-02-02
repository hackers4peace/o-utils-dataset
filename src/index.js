import { promises as jsonld } from 'jsonld'
import _ from 'lodash'

class Dataset {
  /**
   * @param {Storage} storage
   */
  constructor (storage) {
    this.storage = storage
  }

  /**
   * TODO implement proper expansion in shared module
   */
  expand (alias) {
    if (alias === 'rel') {
      return 'http://www.w3.org/ns/ldp#hasMemberRelation'
    } else if (alias === 'rev') {
      return 'http://www.w3.org/ns/ldp#isMemberOfRelation'
    } else if (alias === 'ldp:member') {
      return 'http://www.w3.org/ns/ldp#member'
    }
  }

  /**
   * @param resourceUri
   * @returns {Resource}
   */
  getResource (resourceUri) {
    return this.storage.get(resourceUri)
      .then((normalized) => {
        return jsonld.fromRDF(normalized, { format: 'application/nquads' })
      })
  }

  /**
   * @param resourceUri
   * @param link
   * @returns {Container}
   */
  getLinkedContainer (resourceUri, link) {
    return this.getResource(resourceUri)
      .then((resource) => {
        let reference = _.find(resource, (entity) => {
          if (link[this.expand('rel')] && entity[this.expand('rel')]) {
            return entity[this.expand('rel')].indexOf(link[this.expand('rel')] >= 0)
          } else if (link[this.expand('rev')] && entity[this.expand('rev')]) {
            return entity[this.expand('rev')].indexOf(link[this.expand('rev')] >= 0)
          }
        })
        if (reference) {
          return this.getResource(reference['@id'])
        } else {
          return Promise.reject('needs rel or rev')
        }
      })
  }

  /**
   * @param resourceUri
   * @param data
   * @returns {Uri} - uri of the resource
   */
  createResource (resourceUri, data) {
    return this.updateResource(resourceUri, data)
  }

  /**
   * @param resourceUri
   * @param data
   * @returns {Resource}
   */
  updateResource (resourceUri, data) {
    return jsonld.normalize(data, { algorithm: 'URDNA2015', format: 'application/nquads' })
    .then((normalized) => {
      return this.storage.put(resourceUri, normalized)
    }).then((hash) => {
      return resourceUri
    })
  }

  /**
   * @param containerUri
   * @param memberUri
   * @returns {Uri} - uri of container
   */
  addMemberToContainer (containerUri, memberUri) {
    return this.getResource(containerUri)
      .then((resource) => {
        let container = resource[0]
        if (container[this.expand('ldp:member')]) {
          container[this.expand('ldp:member')].push({ '@id': memberUri })
        } else {
          container[this.expand('ldp:member')] = [ { '@id': memberUri } ]
        }
        // TODO: container[this.expand('hydra:totalItems')]++
        return this.updateResource(containerUri, container)
      }).then((uri) => {
        return uri
      })
  }

  /**
   * @param resourceUri
   * @param data
   * @returns {Uri} - uri of updated resource
   */
  appendToResource (resourceUri, data) {
    return this.getResource(resourceUri)
      .then((expanded) => {
        expanded.push(data)
        return this.updateResource(resourceUri, expanded)
      })
  }
}

export { Dataset as default }
