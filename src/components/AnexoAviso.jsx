import { useEffect, useState } from 'react'
import { FileText, X } from 'lucide-react'
import { ehImagem, formatarTamanho, obterAnexoDados } from '../utils/anexosAviso'

// Converte data URL em Blob URL de forma SÍNCRONA — precisa acontecer dentro do
// gesto de toque, senão o Safari/iOS bloqueia a abertura da janela.
function blobUrlDe(dados) {
  const [meta, b64] = String(dados).split(',')
  const mime = /data:(.*?);/.exec(meta)?.[1] || 'application/octet-stream'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

export default function AnexoAviso({ anexo }) {
  const [dados, setDados] = useState(null)
  const [ampliada, setAmpliada] = useState(false)
  const anexoId = anexo?.anexoId
  const imagemAnexo = ehImagem(anexo?.tipo)

  useEffect(() => {
    let ativo = true
    if (anexoId) obterAnexoDados(anexoId).then(d => { if (ativo) setDados(d) })
    return () => { ativo = false }
  }, [anexoId])

  if (!anexoId) return null

  function abrirArquivo() {
    if (!dados) return
    const url = blobUrlDe(dados)
    window.open(url, '_blank', 'noopener')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  if (imagemAnexo) {
    return (
      <>
        <button type="button" style={s.thumbBtn} onClick={() => dados && setAmpliada(true)} aria-label={`Ampliar imagem ${anexo.nome || ''}`}>
          {dados
            ? <img src={dados} alt={anexo.nome || 'Imagem anexada'} style={s.thumbImg} />
            : <span style={s.thumbCarregando}>Carregando imagem...</span>}
        </button>
        {ampliada && (
          <div style={s.lightbox} onClick={() => setAmpliada(false)} role="dialog" aria-modal="true">
            <button type="button" style={s.lightboxFechar} onClick={() => setAmpliada(false)} aria-label="Fechar imagem"><X size={22} /></button>
            <img src={dados} alt={anexo.nome || 'Imagem anexada'} style={s.lightboxImg} onClick={e => e.stopPropagation()} />
          </div>
        )}
      </>
    )
  }

  return (
    <button type="button" style={{ ...s.arquivoCard, opacity: dados ? 1 : 0.6 }} onClick={abrirArquivo} disabled={!dados} aria-label={`Abrir arquivo ${anexo.nome || ''}`}>
      <span style={s.arquivoIcone}><FileText size={18} /></span>
      <span style={s.arquivoInfo}>
        <strong style={s.arquivoNome}>{anexo.nome || 'Arquivo'}</strong>
        <span style={s.arquivoTamanho}>{formatarTamanho(anexo.tamanho)}</span>
      </span>
      <span style={s.arquivoAbrir}>{dados ? 'Abrir' : '...'}</span>
    </button>
  )
}

const s = {
  thumbBtn: { border: 'none', background: 'transparent', padding: 0, marginTop: 6, cursor: 'pointer', display: 'block', textAlign: 'left' },
  thumbImg: { maxWidth: '100%', width: 190, borderRadius: 12, display: 'block', border: '1px solid #E2E8F0' },
  thumbCarregando: { display: 'inline-block', padding: '0.6rem 0.8rem', borderRadius: 12, background: 'rgba(255,255,255,0.65)', border: '1px solid #E2E8F0', color: '#94A3B8', fontSize: '0.72rem', fontWeight: 700 },
  lightbox: { position: 'fixed', inset: 0, background: 'rgba(2,6,23,0.92)', zIndex: 12000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' },
  lightboxImg: { maxWidth: '100%', maxHeight: '88vh', borderRadius: 10, objectFit: 'contain' },
  lightboxFechar: { position: 'absolute', top: 'max(14px, env(safe-area-inset-top, 0px))', right: 14, border: 'none', background: 'rgba(255,255,255,0.14)', color: '#fff', borderRadius: 999, width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  arquivoCard: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, padding: '0.5rem 0.6rem', width: '100%', background: 'rgba(255,255,255,0.75)', border: '1px solid #E2E8F0', borderRadius: 12, color: '#0F172A', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  arquivoIcone: { width: 34, height: 34, borderRadius: 9, background: '#EAF2FF', color: '#003D7C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  arquivoInfo: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 },
  arquivoNome: { fontSize: '0.76rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  arquivoTamanho: { fontSize: '0.68rem', color: '#94A3B8', fontWeight: 700 },
  arquivoAbrir: { fontSize: '0.72rem', fontWeight: 900, color: '#003D7C', flexShrink: 0 },
}
