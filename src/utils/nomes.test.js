import { describe, expect, it } from 'vitest'
import { nomeParaVinculo } from './nomes'

describe('nomeParaVinculo', () => {
  it('ignora acentos, maiusculas e espacos repetidos', () => {
    expect(nomeParaVinculo('  João   da SILVA ')).toBe('joao da silva')
  })

  it('normaliza pontuacao entre partes do nome', () => {
    expect(nomeParaVinculo("Ana D'Ávila-Souza")).toBe('ana d avila souza')
  })

  it('retorna vazio para nome ausente', () => {
    expect(nomeParaVinculo()).toBe('')
  })
})
