export const PERFIS = {
  aluno: 'aluno',
  professor: 'professor',
  admin: 'admin',
  vendedor: 'vendedor',
  cozinha: 'cozinha',
}

export function normalizarPerfil(perfil = '') {
  const p = String(perfil).toLowerCase().trim()

  if (['gerente', 'administrador', 'adm', 'gestor', 'lanchonete'].includes(p)) return PERFIS.admin
  if (['vendedor', 'vendedora', 'atendente'].includes(p)) return PERFIS.vendedor
  if (['cozinheiro', 'cozinha', 'producao', 'produção'].includes(p)) return PERFIS.cozinha
  if (['prof', 'docente', 'professora'].includes(p)) return PERFIS.professor
  if (Object.values(PERFIS).includes(p)) return p
  return PERFIS.aluno
}

export function ehAluno(perfil) {
  const p = normalizarPerfil(perfil)
  return p === PERFIS.aluno || p === PERFIS.professor
}

export function ehOperacional(perfil) {
  const p = normalizarPerfil(perfil)
  return p === PERFIS.vendedor || p === PERFIS.cozinha
}

export function ehGestao(perfil) {
  return normalizarPerfil(perfil) === PERFIS.admin
}

export function ehStaff(perfil) {
  const p = normalizarPerfil(perfil)
  return [PERFIS.admin, PERFIS.vendedor, PERFIS.cozinha].includes(p)
}

export function temAcesso(perfilUsuario, rotaSolicitada) {
  const p = normalizarPerfil(perfilUsuario)
  if (p === PERFIS.admin) return true
  if (p === PERFIS.vendedor) return rotaSolicitada.startsWith('/vendedor')
  if (p === PERFIS.cozinha) return rotaSolicitada.startsWith('/cozinha')
  if (p === PERFIS.aluno || p === PERFIS.professor) return rotaSolicitada.startsWith('/aluno')
  return false
}

export function caminhoInicialPorPerfil(perfil) {
  const p = normalizarPerfil(perfil)
  switch (p) {
    case PERFIS.vendedor: return '/vendedor'
    case PERFIS.cozinha: return '/cozinha'
    case PERFIS.admin: return '/admin'
    case PERFIS.professor:
    case PERFIS.aluno:
    default:
      return '/aluno/cardapio'
  }
}
