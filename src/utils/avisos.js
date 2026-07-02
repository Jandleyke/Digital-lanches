export function usuarioAvisoId(usuario) {
  return usuario?.uid || usuario?.matricula || ''
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
