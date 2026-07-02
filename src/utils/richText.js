const ALLOWED_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'P', 'DIV', 'UL', 'OL', 'LI'])

export function sanitizeRichText(html = '') {
  if (!html) return ''
  if (typeof window === 'undefined' || !window.DOMParser) {
    return String(html).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstChild

  function clean(node) {
    if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent || '')
    if (node.nodeType !== Node.ELEMENT_NODE) return doc.createTextNode('')

    if (!ALLOWED_TAGS.has(node.tagName)) {
      const fragment = doc.createDocumentFragment()
      node.childNodes.forEach(child => fragment.appendChild(clean(child)))
      return fragment
    }

    const tag = node.tagName === 'DIV' ? 'P' : node.tagName
    const element = doc.createElement(tag.toLowerCase())
    node.childNodes.forEach(child => element.appendChild(clean(child)))
    return element
  }

  const output = doc.createElement('div')
  root.childNodes.forEach(child => output.appendChild(clean(child)))
  return output.innerHTML
}

export function richTextToPlainText(html = '') {
  if (!html) return ''
  if (typeof window === 'undefined' || !window.DOMParser) {
    return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(sanitizeRichText(html), 'text/html')
  return (doc.body.textContent || '').replace(/\s+\n/g, '\n').replace(/\n\s+/g, '\n').trim()
}

export function plainTextToRichText(text = '') {
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped
    .split(/\n{2,}/)
    .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br>')}</p>`)
    .join('')
}
