import React from 'react'

// Renderizador markdown mínimo y seguro (sin dependencias ni HTML crudo).
// Soporta: encabezados (#, ##, ###), listas (- ), párrafos, **negrita** y
// enlaces [texto](url). Suficiente para textos legales.

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Token combinado: negrita o enlace.
  const regex = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let i = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`}>{match[1]}</strong>)
    } else if (match[2] !== undefined && match[3] !== undefined) {
      const href = match[3]
      const isInternal = href.startsWith('/')
      nodes.push(
        <a
          key={`${keyPrefix}-a-${i}`}
          href={href}
          className="text-blue-600 underline"
          {...(isInternal ? {} : { target: '_blank', rel: 'noopener noreferrer' })}
        >
          {match[2]}
        </a>
      )
    }
    lastIndex = regex.lastIndex
    i++
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return nodes
}

export default function MarkdownLegal({ contenido }: { contenido: string }) {
  const lines = contenido.replace(/\r\n/g, '\n').split('\n')
  const blocks: React.ReactNode[] = []
  let paragraph: string[] = []
  let listItems: string[] = []
  let key = 0

  function flushParagraph() {
    if (paragraph.length === 0) return
    const text = paragraph.join(' ')
    blocks.push(
      <p key={`p-${key++}`} className="text-sm text-gray-700 leading-relaxed mb-4">
        {renderInline(text, `p${key}`)}
      </p>
    )
    paragraph = []
  }

  function flushList() {
    if (listItems.length === 0) return
    blocks.push(
      <ul key={`ul-${key++}`} className="list-disc pl-5 mb-4 space-y-1">
        {listItems.map((item, idx) => (
          <li key={idx} className="text-sm text-gray-700 leading-relaxed">
            {renderInline(item, `li${key}-${idx}`)}
          </li>
        ))}
      </ul>
    )
    listItems = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (line.trim() === '') {
      flushParagraph()
      flushList()
      continue
    }
    if (line.startsWith('### ')) {
      flushParagraph(); flushList()
      blocks.push(<h3 key={`h3-${key++}`} className="text-base font-bold text-gray-900 mt-5 mb-2">{renderInline(line.slice(4), `h3${key}`)}</h3>)
    } else if (line.startsWith('## ')) {
      flushParagraph(); flushList()
      blocks.push(<h2 key={`h2-${key++}`} className="text-lg font-bold text-gray-900 mt-6 mb-2">{renderInline(line.slice(3), `h2${key}`)}</h2>)
    } else if (line.startsWith('# ')) {
      flushParagraph(); flushList()
      blocks.push(<h1 key={`h1-${key++}`} className="text-xl font-bold text-gray-900 mb-4">{renderInline(line.slice(2), `h1${key}`)}</h1>)
    } else if (line.startsWith('- ')) {
      flushParagraph()
      listItems.push(line.slice(2))
    } else {
      flushList()
      paragraph.push(line.trim())
    }
  }
  flushParagraph()
  flushList()

  return <div>{blocks}</div>
}
