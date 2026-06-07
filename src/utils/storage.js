export function carregarLS(chave, fallback) {
  try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : fallback }
  catch { return fallback }
}

export function salvarLS(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)) } catch { /* armazenamento indisponível (modo privado, quota etc.) */ }
}

// Sessão do usuário usa sessionStorage: persiste no F5 mas é isolada por aba.
// Assim admin em uma aba e aluno em outra não se misturam.
export function carregarSessao() {
  try {
    const v = sessionStorage.getItem('senac_sessao')
    if (v) return JSON.parse(v)
    // Migração única: se havia sessão no localStorage antigo, move para sessionStorage
    const old = localStorage.getItem('senac_usuario')
    if (old) {
      sessionStorage.setItem('senac_sessao', old)
      localStorage.removeItem('senac_usuario')
      return JSON.parse(old)
    }
    return null
  } catch { return null }
}

export function salvarSessao(valor) {
  try {
    if (valor) sessionStorage.setItem('senac_sessao', JSON.stringify(valor))
    else sessionStorage.removeItem('senac_sessao')
  } catch { /* armazenamento indisponível (modo privado, quota etc.) */ }
}
