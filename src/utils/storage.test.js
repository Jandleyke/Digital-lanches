import { describe, it, expect, beforeEach } from 'vitest'
import { carregarLS, salvarLS, carregarSessao, salvarSessao } from './storage'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('carregarLS / salvarLS', () => {
  it('salva e recupera valores serializados em JSON', () => {
    salvarLS('chave', { a: 1, b: [1, 2, 3] })
    expect(carregarLS('chave', null)).toEqual({ a: 1, b: [1, 2, 3] })
  })

  it('retorna o fallback quando a chave não existe', () => {
    expect(carregarLS('inexistente', 'padrao')).toBe('padrao')
  })

  it('retorna o fallback quando o valor armazenado não é JSON válido', () => {
    localStorage.setItem('corrompido', '{invalido')
    expect(carregarLS('corrompido', [])).toEqual([])
  })
})

describe('carregarSessao / salvarSessao', () => {
  it('salva e recupera a sessão do usuário', () => {
    salvarSessao({ matricula: '123', nome: 'Aluno' })
    expect(carregarSessao()).toEqual({ matricula: '123', nome: 'Aluno' })
  })

  it('remove a sessão quando salva com valor nulo', () => {
    salvarSessao({ matricula: '123' })
    salvarSessao(null)
    expect(carregarSessao()).toBeNull()
  })

  it('migra sessão antiga do localStorage para o sessionStorage', () => {
    localStorage.setItem('senac_usuario', JSON.stringify({ matricula: '999' }))
    expect(carregarSessao()).toEqual({ matricula: '999' })
    expect(localStorage.getItem('senac_usuario')).toBeNull()
    expect(sessionStorage.getItem('senac_sessao')).not.toBeNull()
  })
})
