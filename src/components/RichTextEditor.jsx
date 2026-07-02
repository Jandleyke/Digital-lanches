import { useEffect, useRef } from 'react'
import { Bold, Eraser, Italic, List, ListOrdered, Underline } from 'lucide-react'
import { richTextToPlainText, sanitizeRichText } from '../utils/richText'

export function RichTextContent({ html, text, style }) {
  const rich = sanitizeRichText(html || '')
  if (rich) {
    return <div style={style} className="rich-text-content" dangerouslySetInnerHTML={{ __html: rich }} />
  }
  return text ? <p style={style}>{text}</p> : null
}

export default function RichTextEditor({ value, onChange, placeholder = 'Descreva o aviso...' }) {
  const editorRef = useRef(null)
  const lastValueRef = useRef('')

  useEffect(() => {
    const next = sanitizeRichText(value || '')
    if (editorRef.current && next !== lastValueRef.current) {
      editorRef.current.innerHTML = next
      lastValueRef.current = next
    }
  }, [value])

  function emitChange() {
    const html = sanitizeRichText(editorRef.current?.innerHTML || '')
    lastValueRef.current = html
    onChange?.({ html, text: richTextToPlainText(html) })
  }

  function runCommand(command) {
    editorRef.current?.focus()
    document.execCommand(command, false, null)
    emitChange()
  }

  function clearFormat() {
    editorRef.current?.focus()
    document.execCommand('removeFormat', false, null)
    emitChange()
  }

  const isEmpty = !richTextToPlainText(value || '')

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar} aria-label="Formatacao da mensagem">
        <button type="button" title="Negrito" style={styles.toolBtn} onClick={() => runCommand('bold')}><Bold size={16} /></button>
        <button type="button" title="Italico" style={styles.toolBtn} onClick={() => runCommand('italic')}><Italic size={16} /></button>
        <button type="button" title="Sublinhado" style={styles.toolBtn} onClick={() => runCommand('underline')}><Underline size={16} /></button>
        <span style={styles.separator} />
        <button type="button" title="Lista com marcadores" style={styles.toolBtn} onClick={() => runCommand('insertUnorderedList')}><List size={16} /></button>
        <button type="button" title="Lista numerada" style={styles.toolBtn} onClick={() => runCommand('insertOrderedList')}><ListOrdered size={16} /></button>
        <span style={styles.separator} />
        <button type="button" title="Limpar formatacao" style={styles.toolBtn} onClick={clearFormat}><Eraser size={16} /></button>
      </div>
      <div style={styles.editorWrap}>
        {isEmpty && <span style={styles.placeholder}>{placeholder}</span>}
        <div
          ref={editorRef}
          style={styles.editor}
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
        />
      </div>
    </div>
  )
}

const styles = {
  wrapper: { border: '2px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', background: '#fff' },
  toolbar: { minHeight: 42, display: 'flex', alignItems: 'center', gap: 4, padding: '0.35rem 0.45rem', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', flexWrap: 'wrap' },
  toolBtn: { width: 32, height: 32, border: '1px solid transparent', borderRadius: 8, background: '#fff', color: '#334155', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  separator: { width: 1, height: 22, background: '#CBD5E1', margin: '0 0.25rem' },
  editorWrap: { position: 'relative' },
  placeholder: { position: 'absolute', left: 14, top: 13, color: '#64748B', fontSize: '0.9rem', pointerEvents: 'none' },
  editor: { minHeight: 110, padding: '0.75rem 0.9rem', outline: 'none', color: '#1F2937', fontSize: '0.9rem', lineHeight: 1.5, fontFamily: 'inherit', overflowWrap: 'anywhere' },
}
