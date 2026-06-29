import { describe, expect, it } from 'vitest'
import { caminhoInicialPorPerfil, ehGestao, normalizarPerfil, perfisDoUsuario, perfisParaExibicao, perfisPorTipoEntrada, temAcesso } from './perfis'

describe('perfis de acesso', () => {
  it('mantem compatibilidade com perfil antigo', () => {
    expect(perfisDoUsuario({ perfil: 'vendedora' })).toEqual(['vendedor'])
  })

  it('normaliza e remove perfis duplicados', () => {
    expect(perfisDoUsuario({ roles: ['cozinha', 'vendedora', 'cozinha', 'admin'] }))
      .toEqual(['admin', 'vendedor', 'cozinha'])
  })

  it('mantem gerente como acesso de gestao', () => {
    expect(normalizarPerfil('gerente')).toBe('gerente')
    expect(ehGestao('gerente')).toBe(true)
    expect(caminhoInicialPorPerfil('gerente')).toBe('/admin')
  })

  it('aceita usuario ainda nao carregado sem quebrar a tela', () => {
    expect(perfisDoUsuario(null)).toEqual(['aluno'])
  })

  it('separa os acessos de aluno e equipe', () => {
    const usuario = { roles: ['aluno', 'professor', 'admin', 'vendedor', 'cozinha'] }
    expect(perfisPorTipoEntrada({ roles: ['aluno'] }, 'aluno')).toEqual(['aluno'])
    expect(perfisPorTipoEntrada(usuario, 'aluno')).toEqual([])
    expect(perfisPorTipoEntrada(usuario, 'equipe')).toEqual(['professor', 'admin', 'vendedor', 'cozinha'])
  })

  it('exibe professor no lugar de aluno quando os dois estiverem habilitados', () => {
    expect(perfisParaExibicao({ roles: ['aluno', 'professor', 'admin'] })).toEqual(['professor', 'admin'])
    expect(perfisParaExibicao({ roles: ['aluno', 'admin'] })).toEqual(['aluno', 'admin'])
  })

  it('permite professor acessar avisos e telas de aluno', () => {
    expect(temAcesso('professor', '/aluno/cardapio')).toBe(true)
    expect(temAcesso('professor', '/professor/avisos')).toBe(true)
    expect(temAcesso('aluno', '/professor/avisos')).toBe(false)
  })
})
