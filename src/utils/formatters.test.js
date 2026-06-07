import { describe, it, expect } from 'vitest'
import { formatPrice, formatDate, formatTime } from './formatters'

describe('formatPrice', () => {
  it('formata números em reais com vírgula decimal', () => {
    expect(formatPrice(12.5)).toBe('R$ 12,50')
    expect(formatPrice(0)).toBe('R$ 0,00')
    expect(formatPrice(1234.567)).toBe('R$ 1234,57')
  })

  it('trata valores nulos/indefinidos como zero', () => {
    expect(formatPrice(null)).toBe('R$ 0,00')
    expect(formatPrice(undefined)).toBe('R$ 0,00')
  })
})

describe('formatDate', () => {
  it('formata timestamp como data no padrão pt-BR', () => {
    const ts = new Date(2026, 5, 15).getTime()
    expect(formatDate(ts)).toBe('15/06/2026')
  })
})

describe('formatTime', () => {
  it('formata timestamp como hora:minuto', () => {
    const ts = new Date(2026, 5, 15, 9, 5).getTime()
    expect(formatTime(ts)).toMatch(/^09:05/)
  })
})
