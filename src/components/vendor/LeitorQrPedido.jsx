import { useEffect, useId, useRef, useState } from 'react'
import { ScanLine, X } from 'lucide-react'

async function encerrarScanner(scanner) {
  if (!scanner) return
  try {
    if (scanner.isScanning) await scanner.stop()
  } catch {
    // O navegador pode encerrar a camera antes da limpeza do componente.
  }
  try {
    await scanner.clear()
  } catch {
    // A area do leitor pode ter sido removida durante o fechamento do modal.
  }
}

export default function LeitorQrPedido({ aberto, onClose, onResultado }) {
  const reactId = useId()
  const leitorId = `leitor-qr-pedido-${reactId.replace(/:/g, '')}`
  const onResultadoRef = useRef(onResultado)
  const processandoRef = useRef(false)
  const ultimaLeituraRef = useRef({ conteudo: '', horario: 0 })
  const [erro, setErro] = useState('')

  useEffect(() => {
    onResultadoRef.current = onResultado
  }, [onResultado])

  useEffect(() => {
    if (!aberto) return undefined

    let ativo = true
    let scanner = null
    processandoRef.current = false

    async function iniciarScanner() {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (!ativo) return

        scanner = new Html5Qrcode(leitorId)
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (largura, altura) => {
              const tamanho = Math.max(180, Math.min(260, largura - 32, altura - 32))
              return { width: tamanho, height: tamanho }
            },
          },
          async conteudo => {
            if (!ativo || processandoRef.current) return
            const agora = Date.now()
            if (ultimaLeituraRef.current.conteudo === conteudo && agora - ultimaLeituraRef.current.horario < 2500) return
            ultimaLeituraRef.current = { conteudo, horario: agora }
            processandoRef.current = true
            const aceito = await onResultadoRef.current(conteudo)
            if (aceito === false) processandoRef.current = false
          },
          () => {}
        )
      } catch {
        if (ativo) setErro('Não foi possível acessar a câmera. Verifique a permissão do navegador.')
      }
    }

    iniciarScanner()
    return () => {
      ativo = false
      processandoRef.current = false
      void encerrarScanner(scanner)
    }
  }, [aberto, leitorId])

  if (!aberto) return null

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="titulo-leitor-qr">
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={styles.tituloGrupo}>
            <span style={styles.icone}><ScanLine size={22} /></span>
            <div>
              <h3 id="titulo-leitor-qr" style={styles.titulo}>Ler QR Code do pedido</h3>
              <p style={styles.subtitulo}>Aponte a câmera para o código do aluno.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={styles.fechar} aria-label="Fechar leitor" title="Fechar leitor">
            <X size={20} />
          </button>
        </div>

        <div style={styles.cameraMoldura}>
          <div id={leitorId} style={styles.camera} />
        </div>
        {erro && <p role="alert" style={styles.erro}>{erro}</p>}
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 10020, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 16, background: 'rgba(15, 23, 42, 0.72)',
  },
  modal: {
    width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16, padding: 18,
    boxShadow: '0 24px 80px rgba(15, 23, 42, 0.3)', overflow: 'hidden',
  },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 },
  tituloGrupo: { display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 },
  icone: {
    width: 42, height: 42, borderRadius: 10, flexShrink: 0, display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#003D7C',
  },
  titulo: { margin: 0, color: '#0F172A', fontSize: '1.05rem', fontWeight: 900 },
  subtitulo: { margin: '3px 0 0', color: '#64748B', fontSize: '0.82rem', lineHeight: 1.35 },
  fechar: {
    width: 40, height: 40, borderRadius: 10, border: 'none', background: '#F1F5F9', color: '#334155',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0,
  },
  cameraMoldura: { overflow: 'hidden', borderRadius: 12, background: '#0F172A', minHeight: 280 },
  camera: { width: '100%', minHeight: 280 },
  erro: {
    margin: '12px 0 0', padding: '0.7rem 0.8rem', borderRadius: 10,
    background: '#FEE2E2', color: '#B91C1C', fontSize: '0.84rem', fontWeight: 700,
  },
}
