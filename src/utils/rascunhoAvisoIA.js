import { plainTextToRichText } from './richText'

function normalizar(texto = '') {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function tituloNome(texto = '') {
  return String(texto)
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, letra => letra.toUpperCase())
}

function extrairDatas(texto = '') {
  const datas = String(texto).match(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g) || []
  return [...new Set(datas.map(data => data.replaceAll('-', '/')))]
}

function extrairTurno(textoNormalizado = '') {
  if (textoNormalizado.includes('vespertino') || textoNormalizado.includes('tarde')) return 'tarde'
  if (textoNormalizado.includes('matutino') || textoNormalizado.includes('manha')) return 'manha'
  if (textoNormalizado.includes('noite') || textoNormalizado.includes('noturno')) return 'noite'
  return ''
}

function extrairTurma(texto = '') {
  const match = String(texto).match(/\bturma\s*[:-]?\s*([a-zA-Z0-9]+)/i)
  return match?.[1] || ''
}

function extrairAlunos(texto = '') {
  const match = String(texto).match(/\b(\d{1,3})\s*(?:alunos|alunas|pessoas)\b/i)
  return match?.[1] || ''
}

function textoDatas(datas) {
  if (datas.length === 0) return ''
  if (datas.length === 1) return `no dia ${datas[0]}`
  return `nos dias ${datas.slice(0, -1).join(', ')} e ${datas.at(-1)}`
}

export const exemplosAvisoIA = [
  'Nao havera aula no dia 10/07 para a turma 75 no turno da tarde.',
  'Confirmacao de turma dia 06/07 manha, turma 88, total 20 alunos.',
  'Avisar cozinha que dia 09/07 tera 18 alunos no turno da manha.',
]

export function gerarRascunhoAvisoIA(entrada) {
  const bruto = String(entrada || '').trim()
  if (!bruto) throw new Error('Descreva o aviso para a IA montar o rascunho.')

  const texto = normalizar(bruto)
  const datas = extrairDatas(bruto)
  const turno = extrairTurno(texto)
  const turma = extrairTurma(bruto)
  const alunos = extrairAlunos(bruto)
  const quando = textoDatas(datas)

  const semAula = /(nao havera aula|sem aula|aula cancelada|nao tera aula|nao haverá aula)/.test(texto)
  const confirmacao = /(confirmacao|confirmar|presenca|quantidade|total)/.test(texto) && (turma || alunos)
  const cozinha = /(cozinha|producao|produção|lanches|cardapio|cardápio)/.test(texto)

  let titulo
  let tipo = 'info'
  let prioridade = 'media'
  let mensagem

  if (semAula) {
    titulo = datas.length ? `Aula cancelada ${datas.join(' e ')}` : 'Aula cancelada'
    tipo = 'aviso'
    prioridade = 'alta'
    mensagem = [
      `Informamos que nao havera aula ${quando || 'na data informada'}.`,
      turma ? `Turma: ${turma}.` : '',
      turno ? `Turno: ${turno}.` : '',
      'Pedimos que a equipe se organize conforme essa alteracao.',
    ].filter(Boolean).join('\n')
  } else if (confirmacao) {
    titulo = datas.length ? `Confirmacao de presenca - ${datas.join(' e ')}` : 'Confirmacao de presenca'
    tipo = 'info'
    prioridade = alunos && Number(alunos) >= 25 ? 'alta' : 'media'
    mensagem = [
      `Confirmamos a presenca da turma ${turma || 'informada'} ${quando || 'na data informada'}.`,
      turno ? `Turno: ${turno}.` : '',
      alunos ? `Total previsto: ${alunos} alunos.` : '',
      'Solicitamos que a equipe acompanhe essa previsao para organizar o atendimento.',
    ].filter(Boolean).join('\n')
  } else if (cozinha) {
    titulo = datas.length ? `Aviso para a cozinha - ${datas.join(' e ')}` : 'Aviso para a cozinha'
    tipo = 'info'
    prioridade = 'media'
    mensagem = [
      `Aviso para organizacao da cozinha${quando ? ` ${quando}` : ''}.`,
      turno ? `Turno: ${turno}.` : '',
      turma ? `Turma: ${turma}.` : '',
      alunos ? `Quantidade prevista: ${alunos} alunos.` : '',
      bruto,
    ].filter(Boolean).join('\n')
  } else {
    const resumo = bruto.split(/[.!?]/).find(Boolean) || bruto
    titulo = tituloNome(resumo).slice(0, 72) || 'Novo comunicado'
    mensagem = bruto
  }

  return {
    titulo,
    mensagem,
    mensagemHtml: plainTextToRichText(mensagem),
    tipo,
    prioridade,
  }
}
