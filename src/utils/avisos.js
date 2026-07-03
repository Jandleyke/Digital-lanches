import { normalizarPerfil } from './perfis'

export function usuarioAvisoId(usuario) {
  return usuario?.uid || usuario?.matricula || ''
}

export function usuarioAvisoIds(usuario) {
  return [
    usuario?.uid,
    usuario?.matricula,
    usuario?.email,
    usuario?.id,
  ].filter(Boolean).map(String)
}

export function avisoCriadoPorUsuario(aviso, usuario) {
  const ids = usuarioAvisoIds(usuario)
  const autores = [
    aviso?.createdBy,
    aviso?.autorId,
    aviso?.createdByMatricula,
    aviso?.autorMatricula,
    aviso?.createdByEmail,
  ].filter(Boolean).map(String)
  return ids.some(id => autores.includes(id))
}

export function destinoAvisoNormalizado(aviso) {
  const destino = aviso?.destino || aviso?.destinatario || 'todos'
  if (destino === 'alunos') return 'aluno'
  if (destino === 'vendedora') return 'vendedor'
  return destino
}

export function destinosAvisoNormalizados(aviso) {
  const lista = Array.isArray(aviso?.destinos) && aviso.destinos.length > 0
    ? aviso.destinos
    : [destinoAvisoNormalizado(aviso)]
  return [...new Set(lista.map(destino => {
    if (destino === 'alunos') return 'aluno'
    if (destino === 'vendedora') return 'vendedor'
    return destino || 'todos'
  }))]
}

export function avisoTemDestinatariosEspecificos(aviso) {
  return Array.isArray(aviso?.recipients) && aviso.recipients.length > 0
}

export function avisoDestinadoAoUsuario(aviso, usuario, perfilNormalizado) {
  if (!aviso || aviso.deletedAt || aviso.status === 'excluido') return false
  if (avisoCriadoPorUsuario(aviso, usuario)) return true

  const ids = usuarioAvisoIds(usuario)
  const recipients = Array.isArray(aviso.recipients) ? aviso.recipients.map(String) : []
  if (recipients.length > 0) return ids.some(id => recipients.includes(id))

  const perfil = normalizarPerfil(perfilNormalizado || usuario?.role || usuario?.perfil || '')
  const destinos = destinosAvisoNormalizados(aviso)
  return destinos.includes('todos') || destinos.includes(perfil)
}

export function chaveArquivoAviso(usuarioOuId, escopo = 'geral') {
  const id = typeof usuarioOuId === 'string' ? usuarioOuId : usuarioAvisoId(usuarioOuId)
  return id ? `${escopo || 'geral'}:${id}` : ''
}

export function avisoArquivadoParaUsuario(aviso, usuarioOuId, escopo = 'geral') {
  const id = chaveArquivoAviso(usuarioOuId, escopo)
  const arquivados = Array.isArray(aviso?.arquivadoPorUsuarios) ? aviso.arquivadoPorUsuarios : []
  return !!id && arquivados.includes(id)
}

export function avisoFixadoParaUsuario(aviso, usuarioOuId, escopo = 'geral') {
  const id = chaveArquivoAviso(usuarioOuId, escopo)
  const fixados = Array.isArray(aviso?.fixadoPorUsuarios) ? aviso.fixadoPorUsuarios : []
  return !!id && fixados.includes(id)
}

export function avisoHistoricoLimpoParaUsuario(aviso, usuarioOuId, escopo = 'geral') {
  const id = chaveArquivoAviso(usuarioOuId, escopo)
  const ocultos = Array.isArray(aviso?.historicoOcultoPorUsuarios) ? aviso.historicoOcultoPorUsuarios : []
  return !!id && ocultos.includes(id)
}
