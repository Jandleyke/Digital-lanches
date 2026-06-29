const DIA_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

function normalizarDia(valor) {
  return String(valor || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function toMinutos(valor) {
  if (!valor) return null
  const [hora, minuto] = String(valor).split(':').map(Number)
  if (!Number.isInteger(hora) || !Number.isInteger(minuto) || hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null
  return hora * 60 + minuto
}

export function calcularStatusLanchonete(config = {}, agora = new Date()) {
  const dias = Array.isArray(config.diasFuncionamento)
    ? config.diasFuncionamento.map(normalizarDia).filter(Boolean)
    : []
  const hoje = DIA_SEMANA[agora.getDay()]
  const funcionaHoje = dias.includes(hoje)

  const abertura = toMinutos(config.horarioAbertura)
  const fechamento = toMinutos(config.horarioFechamento)
  const agoraMin = agora.getHours() * 60 + agora.getMinutes()

  if (abertura !== null && fechamento !== null && abertura > fechamento) {
    const ontem = DIA_SEMANA[(agora.getDay() + 6) % 7]
    const funcionaOntem = dias.length === 0 || dias.includes(ontem)
    const aberta = (funcionaHoje && agoraMin >= abertura) || (funcionaOntem && agoraMin < fechamento)
    if (aberta) return { texto: 'Aberta agora', aberta: true }
    if (dias.length > 0 && !funcionaHoje) return { texto: 'Fechada hoje', aberta: false }
    if (agoraMin < abertura) return { texto: `Abre às ${config.horarioAbertura}`, aberta: false }
    return { texto: 'Fechada agora', aberta: false }
  }

  if (dias.length > 0 && !funcionaHoje) return { texto: 'Fechada hoje', aberta: false }

  if (abertura !== null && fechamento !== null) {
    if (agoraMin >= abertura && agoraMin < fechamento) return { texto: 'Aberta agora', aberta: true }
    if (agoraMin < abertura) return { texto: `Abre às ${config.horarioAbertura}`, aberta: false }
    return { texto: 'Fechada agora', aberta: false }
  }

  if (dias.length > 0 && funcionaHoje) return { texto: 'Aberta hoje', aberta: true }
  return null
}
