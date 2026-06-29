import { describe, expect, it } from 'vitest'
import { calcularStatusLanchonete } from './lanchonete'

const config = {
  diasFuncionamento: ['segunda'],
  horarioAbertura: '09:00',
  horarioFechamento: '18:00',
}

describe('status da lanchonete', () => {
  it('identifica quando esta aberta', () => {
    expect(calcularStatusLanchonete(config, new Date(2026, 5, 22, 10, 0))).toEqual({ texto: 'Aberta agora', aberta: true })
  })

  it('abre exatamente no horario configurado', () => {
    expect(calcularStatusLanchonete(config, new Date(2026, 5, 22, 9, 0))).toEqual({ texto: 'Aberta agora', aberta: true })
  })

  it('normaliza dias com acento e letras maiusculas', () => {
    const comDiaNormalizado = { ...config, diasFuncionamento: ['Segunda', 'Terça'] }
    expect(calcularStatusLanchonete(comDiaNormalizado, new Date(2026, 5, 23, 10, 0))).toEqual({ texto: 'Aberta agora', aberta: true })
  })

  it('identifica quando esta fechada', () => {
    expect(calcularStatusLanchonete(config, new Date(2026, 5, 22, 20, 0))).toEqual({ texto: 'Fechada agora', aberta: false })
  })

  it('nao bloqueia quando nao ha horario configurado', () => {
    expect(calcularStatusLanchonete({}, new Date(2026, 5, 22, 20, 0))).toBeNull()
  })

  it('mantem aberto depois da meia-noite em horarios noturnos', () => {
    const noturna = {
      diasFuncionamento: ['segunda'],
      horarioAbertura: '20:00',
      horarioFechamento: '02:00',
    }
    expect(calcularStatusLanchonete(noturna, new Date(2026, 5, 23, 1, 0))).toEqual({ texto: 'Aberta agora', aberta: true })
  })
})
