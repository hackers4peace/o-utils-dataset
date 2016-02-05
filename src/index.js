import _ from 'lodash'
import rdf from 'rdf-ext'
import N3Parser from 'rdf-parser-n3'
import JsonldParser from 'rdf-parser-jsonld'
import normalize from 'rdf-normalize'

class Dataset {
  /**
   * @param {Storage} storage
   */
  constructor (storage) {
    this.storage = storage
    this.parsers = {
      n3: new N3Parser(),
      jsonld: new JsonldParser()
    }
  }

  /**
   * TODO implement proper expansion in shared module
   */
  expand (alias) {
    if (alias === 'rel') {
      return 'http://www.w3.org/ns/ldp#hasMemberRelation'
    } else if (alias === 'rev') {
      return 'http://www.w3.org/ns/ldp#isMemberOfRelation'
    } else if (alias === 'resource') {
      return 'http://www.w3.org/ns/ldp#:membershipResource'
    } else if (alias === 'ldp:member') {
      return 'http://www.w3.org/ns/ldp#member'
    } else if (alias === 'ldp:DirectContainer') {
      return 'http://www.w3.org/ns/ldp#DirectContainer'
    }
  }

  /**
   * @param resourceUri
   * @returns {Resource}
   */
  getResource (resourceUri) {
    return this.storage.get(resourceUri)
      .then((normalized) => {
        return this.parsers.n3.parse(normalized)
      })
  }

  /**
   * @param resourceUri
   * @param link
   * @returns {Container}
   */
  getLinkedContainerUri (resourceUri, link) {
    return this.getResource(resourceUri)
      .then((graph) => {
        let triple
        if (link[this.expand('rel')]) {
          triple = graph.match(null, this.expand('rel'), link[this.expand('rel')]).toArray()[0]
        } else if (link[this.expand('rev')]) {
          triple = graph.match(null, this.expand('rel'), link[this.expand('rel')]).toArray()[0]
        } else {
          return Promise.reject('needs rel or rev')
        }
        return triple.subject.nominalValue
      })
  }

  /**
   * @param resourceUri
   * @param graph
   * @returns {Uri} - uri of the resource
   */
  createResource (resourceUri, graph) {
    return this.updateResource(resourceUri, graph)
  }

  /**
   * @param resourceUri
   * @param graph
   * @returns {Uri}
   */
  updateResource (resourceUri, graph) {
    let normalized = normalize(graph)
    return this.storage.put(resourceUri, normalized)
      .then((hash) => {
        return resourceUri
      })
  }

  /**
   * @param containerUri
   * @param resourceUri
   * @param link
   * @returns {Uri}
   */
  createLinkedContainer (containerUri, resourceUri, link) {
    let container = {
      '@id': containerUri,
      '@type': this.expand('ldp:DirectContainer'),
      [ this.expand('resource') ]: { '@id': resourceUri }
    }
    if (link[this.expand('rel')]) {
      container[this.expand('rel')] = link[this.expand('rel')]
    } else if (link[this.expand('rev')]) {
      container[this.expand('rev')] = link[this.expand('rev')]
    }
    return this.parsers.jsonld.parse(container)
      .then((graph) => {
        return this.createResource(containerUri, graph)
      })
  }

  /**
   * @param containerUri
   * @param memberUri
   * @returns {Uri} - uri of container
   * TODO: container[this.expand('hydra:totalItems')]++
   */
  addMemberToContainer (containerUri, memberUri) {
    return this.getResource(containerUri)
      .then((graph) => {
        let subject = new rdf.NamedNode(containerUri)
        let predicate = new rdf.NamedNode(this.expand('ldp:member'))
        let object = new rdf.NamedNode(memberUri)
        let triple = new rdf.Triple(subject, predicate, object)
        graph.add(triple)
        return this.updateResource(containerUri, graph)
      }).then((uri) => {
        return uri
      })
  }

  /**
   * @param resourceUri
   * @param graph
   * @returns {Uri} - uri of updated resource
   */
  appendToResource (resourceUri, graph) {
    return this.getResource(resourceUri)
      .then((original) => {
        let merged = original.merge(graph)
        return this.updateResource(resourceUri, merged)
      })
  }
}

export { Dataset as default }
