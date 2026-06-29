export const PERFIS = {
  aluno: 'aluno',
  professor: 'professor',
  admin: 'admin',
  gerente: 'gerente',
  vendedor: 'vendedor',
  cozinha: 'cozinha',
}

export const ORDEM_PERFIS = [PERFIS.aluno, PERFIS.professor, PERFIS.admin, PERFIS.gerente, PERFIS.vendedor, PERFIS.cozinha]

export const PERFIL_INFO = {
  aluno: { nome: 'Aluno', descricao: 'Veja o cardápio, faça pedidos e acompanhe suas compras.' },
  professor: { nome: 'Professor', descricao: 'Acompanhe pedidos, comunicados e sua conta na cantina.' },
  admin: { nome: 'Administração', descricao: 'Gerencie usuários, produtos, estoque e relatórios.' },
  gerente: { nome: 'Gerente', descricao: 'Acompanhe a operação, usuários e relatórios.' },
  vendedor: { nome: 'Vendedor', descricao: 'Realize vendas, entregue pedidos e acompanhe pagamentos.' },
  cozinha: { nome: 'Cozinha', descricao: 'Veja pedidos e registre a produção.' },
}

export function normalizarPerfil(perfil = '') {
  const p = String(perfil).toLowerCase().trim()

  if (['administrador', 'adm', 'lanchonete'].includes(p)) return PERFIS.admin
  if (['gerente', 'gestor'].includes(p)) return PERFIS.gerente
  if (['vendedor', 'vendedora', 'atendente'].includes(p)) return PERFIS.vendedor
  if (['cozinheiro', 'cozinha', 'producao', 'produção'].includes(p)) return PERFIS.cozinha
  if (['prof', 'docente', 'professora'].includes(p)) return PERFIS.professor
  if (Object.values(PERFIS).includes(p)) return p
  return PERFIS.aluno
}

export function perfisDoUsuario(usuario = {}) {
  const fonte = usuario || {}
  const lista = Array.isArray(fonte)
    ? fonte
    : Array.isArray(fonte.roles)
      ? fonte.roles
      : Array.isArray(fonte.perfis)
        ? fonte.perfis
        : [fonte.role || fonte.perfil || fonte.tipo || PERFIS.aluno]

  const unicos = [...new Set(lista.map(normalizarPerfil).filter(perfil => ORDEM_PERFIS.includes(perfil)))]
  const ordenados = ORDEM_PERFIS.filter(perfil => unicos.includes(perfil))
  return ordenados.length ? ordenados : [PERFIS.aluno]
}

export function perfisPorTipoEntrada(usuario = {}, tipoEntrada = 'aluno') {
  const perfis = perfisDoUsuario(usuario)
  return tipoEntrada === 'equipe'
    ? perfis.filter(perfil => perfil !== PERFIS.aluno)
    : perfis.includes(PERFIS.professor)
      ? []
      : perfis.filter(perfil => perfil === PERFIS.aluno)
}

export function perfisParaExibicao(usuario = {}) {
  const perfis = perfisDoUsuario(usuario)
  return perfis.includes(PERFIS.professor)
    ? perfis.filter(perfil => perfil !== PERFIS.aluno)
    : perfis
}

export function usuarioTemPerfil(usuario, perfil) {
  return perfisDoUsuario(usuario).includes(normalizarPerfil(perfil))
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
  return [PERFIS.admin, PERFIS.gerente].includes(normalizarPerfil(perfil))
}

export function ehStaff(perfil) {
  const p = normalizarPerfil(perfil)
  return [PERFIS.admin, PERFIS.gerente, PERFIS.vendedor, PERFIS.cozinha].includes(p)
}

export function temAcesso(perfilUsuario, rotaSolicitada) {
  const p = normalizarPerfil(perfilUsuario)
  if (p === PERFIS.admin || p === PERFIS.gerente) return rotaSolicitada.startsWith('/admin')
  if (p === PERFIS.vendedor) return rotaSolicitada.startsWith('/vendedor')
  if (p === PERFIS.cozinha) return rotaSolicitada.startsWith('/cozinha')
  if (p === PERFIS.professor) return rotaSolicitada.startsWith('/aluno') || rotaSolicitada.startsWith('/professor/avisos')
  if (p === PERFIS.aluno) return rotaSolicitada.startsWith('/aluno')
  return false
}

export function caminhoInicialPorPerfil(perfil) {
  const p = normalizarPerfil(perfil)
  switch (p) {
    case PERFIS.vendedor: return '/vendedor'
    case PERFIS.cozinha: return '/cozinha'
    case PERFIS.admin: return '/admin'
    case PERFIS.gerente: return '/admin'
    case PERFIS.professor:
    case PERFIS.aluno:
    default:
      return '/aluno/cardapio'
  }
}
