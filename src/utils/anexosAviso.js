import { addDoc, collection, doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { processarFotoPerfil } from './image'

// Anexos são gravados na coleção `avisosAnexos` (um doc por anexo, conteúdo em
// data URL) porque o projeto não tem bucket do Firebase Storage provisionado —
// ativá-lo exige ação no console (plano Blaze). Se o Storage for ativado um
// dia, basta trocar a implementação de uploadAnexoAviso/obterAnexoDados aqui.

export const ANEXO_ARQUIVO_MAX = 650 * 1024 // limite p/ PDF/DOC/XLS (doc do Firestore aguenta ~1MB em base64)

const TIPOS_ARQUIVO_ACEITOS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

export const ACCEPT_IMAGEM = 'image/*'
export const ACCEPT_ARQUIVO = '.pdf,.doc,.docx,.xls,.xlsx,image/*'

export function ehImagem(tipo) {
  return String(tipo || '').startsWith('image/')
}

export function anexoValido(file) {
  if (!file) return { ok: false, erro: 'Nenhum arquivo selecionado.' }
  if (ehImagem(file.type)) return { ok: true }
  if (!TIPOS_ARQUIVO_ACEITOS.includes(file.type)) {
    return { ok: false, erro: 'Tipo não suportado. Use imagem, PDF, DOC ou XLS.' }
  }
  if (file.size > ANEXO_ARQUIVO_MAX) {
    return { ok: false, erro: `Arquivo muito grande (máximo ${Math.round(ANEXO_ARQUIVO_MAX / 1024)}KB para documentos).` }
  }
  return { ok: true }
}

export function formatarTamanho(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function lerComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
    reader.readAsDataURL(file)
  })
}

export async function uploadAnexoAviso(file, usuario) {
  const validacao = anexoValido(file)
  if (!validacao.ok) throw new Error(validacao.erro)
  try {
    const dados = ehImagem(file.type)
      ? await processarFotoPerfil(file, 1280, 500000)
      : await lerComoDataUrl(file)
    const referencia = await addDoc(collection(db, 'avisosAnexos'), {
      dados,
      nome: file.name || 'anexo',
      tipo: file.type || 'application/octet-stream',
      tamanho: file.size || 0,
      uploadedBy: usuario?.uid || usuario?.matricula || '',
      createdAt: Date.now(),
    })
    return {
      anexoId: referencia.id,
      nome: file.name || 'anexo',
      tipo: file.type || 'application/octet-stream',
      tamanho: file.size || 0,
    }
  } catch (e) {
    console.error('[anexosAviso] upload falhou', { code: e?.code, message: e?.message, serverResponse: e?.serverResponse ?? e?.customData?.serverResponse ?? null })
    throw new Error(e?.message || 'Não foi possível enviar o anexo.', { cause: e })
  }
}

const cacheAnexos = new Map()

export async function obterAnexoDados(anexoId) {
  if (!anexoId) return null
  if (cacheAnexos.has(anexoId)) return cacheAnexos.get(anexoId)
  try {
    const snap = await getDoc(doc(db, 'avisosAnexos', anexoId))
    const dados = snap.exists() ? snap.data()?.dados || null : null
    cacheAnexos.set(anexoId, dados)
    return dados
  } catch (e) {
    console.error('[anexosAviso] leitura falhou', { code: e?.code, message: e?.message, serverResponse: e?.serverResponse ?? null })
    return null
  }
}

