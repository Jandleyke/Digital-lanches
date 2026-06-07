import { describe, it, expect, beforeEach, vi } from 'vitest'
import { suportaNotificacao, permissaoNotificacao, solicitarPermissaoNotificacao, notificarPedidoPronto } from './notifications'

function instalarNotificationMock({ permission = 'default', requestResult = 'granted' } = {}) {
  const construtor = vi.fn(function (titulo, opcoes) {
    this.title = titulo
    this.options = opcoes
  })
  construtor.permission = permission
  construtor.requestPermission = vi.fn().mockResolvedValue(requestResult)
  window.Notification = construtor
  return construtor
}

describe('notifications', () => {
  const original = window.Notification

  beforeEach(() => {
    if (original) window.Notification = original
    else delete window.Notification
  })

  it('detecta quando o navegador não suporta a Notification API', () => {
    delete window.Notification
    expect(suportaNotificacao()).toBe(false)
    expect(permissaoNotificacao()).toBe('unsupported')
  })

  it('reporta a permissão atual quando suportado', () => {
    instalarNotificationMock({ permission: 'granted' })
    expect(suportaNotificacao()).toBe(true)
    expect(permissaoNotificacao()).toBe('granted')
  })

  it('solicita permissão apenas quando o estado é "default"', async () => {
    const mock = instalarNotificationMock({ permission: 'default', requestResult: 'granted' })
    const resultado = await solicitarPermissaoNotificacao()
    expect(mock.requestPermission).toHaveBeenCalled()
    expect(resultado).toBe('granted')
  })

  it('não solicita permissão de novo se já foi concedida ou negada', async () => {
    const mock = instalarNotificationMock({ permission: 'denied' })
    const resultado = await solicitarPermissaoNotificacao()
    expect(mock.requestPermission).not.toHaveBeenCalled()
    expect(resultado).toBe('denied')
  })

  it('cria uma notificação apenas quando a permissão foi concedida', () => {
    const mock = instalarNotificationMock({ permission: 'granted' })
    notificarPedidoPronto({ id: 'P123456789' })
    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock.mock.calls[0][0]).toContain('pronto')
    expect(mock.mock.calls[0][1].body).toContain('23456789')
  })

  it('não cria notificação quando a permissão não foi concedida', () => {
    const mock = instalarNotificationMock({ permission: 'denied' })
    notificarPedidoPronto({ id: 'P123456789' })
    expect(mock).not.toHaveBeenCalled()
  })
})
