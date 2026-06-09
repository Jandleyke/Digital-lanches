import { Clock, Mail, MapPin, Phone, Store, UserRound } from 'lucide-react'
import { useApp } from '../contexts/AppContext'

const DIAS_LABEL = {
  segunda: 'Segunda',
  terca: 'Terca',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
  sabado: 'Sabado',
  domingo: 'Domingo',
}

const DIA_ATUAL = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado']

function juntarEndereco(config) {
  return [config.endereco, config.bairro, config.cidade, config.cep].filter(Boolean).join(' - ')
}

function formatarHorario(config) {
  if (config.horarioAbertura && config.horarioFechamento) {
    return `${config.horarioAbertura} as ${config.horarioFechamento}`
  }
  if (config.horarioAbertura) return `Abre as ${config.horarioAbertura}`
  if (config.horarioFechamento) return `Fecha as ${config.horarioFechamento}`
  return 'Horário não informado'
}

export default function LanchoneteInfoCard({ compacto = false, isMobile = false }) {
  const { lanchoneteConfig } = useApp()
  const config = lanchoneteConfig || {}
  const dias = config.diasFuncionamento || []
  const hoje = DIA_ATUAL[new Date().getDay()]
  const funcionaHoje = dias.includes(hoje)
  const endereco = juntarEndereco(config)
  const contatos = [
    config.telefone && { icon: Phone, texto: config.telefone },
    config.email && { icon: Mail, texto: config.email },
    config.responsavel && { icon: UserRound, texto: `Responsável: ${config.responsavel}` },
  ].filter(Boolean)

  return (
    <section style={{ ...s.card, padding: compacto || isMobile ?'0.9rem' : '1.15rem' }}>
      <div style={s.header}>
        <div style={s.iconBox}>
          <Store size={18} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={s.label}>Lanchonete</p>
          <h2 style={{ ...s.title, fontSize: compacto || isMobile ?'1rem' : '1.12rem' }}>
            {config.nome || 'Senac Lanches'}
          </h2>
        </div>
        {dias.length > 0 && (
          <span style={{ ...s.status, ...(funcionaHoje ?s.statusOk : s.statusOff) }}>
            {funcionaHoje ?'Aberta hoje' : 'Fechada hoje'}
          </span>
        )}
      </div>

      <div style={s.infoGrid}>
        <div style={s.infoItem}>
          <MapPin size={16} style={s.infoIcon} />
          <span>{endereco || 'Localização ainda não cadastrada'}</span>
        </div>
        <div style={s.infoItem}>
          <Clock size={16} style={s.infoIcon} />
          <span>{formatarHorario(config)}</span>
        </div>
      </div>

      {dias.length > 0 && (
        <div style={s.dias}>
          {dias.map(dia => (
            <span key={dia} style={{ ...s.diaPill, ...(dia === hoje ?s.diaHoje : {}) }}>
              {DIAS_LABEL[dia] || dia}
            </span>
          ))}
        </div>
      )}

      {!compacto && contatos.length > 0 && (
        <div style={s.contatos}>
          {contatos.map(({ icon: Icon, texto }) => (
            <span key={texto} style={s.contatoItem}>
              <Icon size={14} />
              {texto}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

const s = {
  card: { background: '#fff', borderRadius: 18, boxShadow: '0 14px 34px rgba(15,23,42,0.07)', border: '1px solid #E5E7EB' },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconBox: { width: 38, height: 38, borderRadius: 12, background: '#FFF7ED', color: '#F47920', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { margin: 0, color: '#64748B', fontSize: '0.76rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0 },
  title: { margin: '0.2rem 0 0', color: '#0F172A', fontWeight: 900, lineHeight: 1.2, overflowWrap: 'anywhere' },
  status: { marginLeft: 'auto', padding: '0.32rem 0.65rem', borderRadius: 999, fontSize: '0.72rem', fontWeight: 800, whiteSpace: 'nowrap' },
  statusOk: { background: '#D1FAE5', color: '#047857' },
  statusOff: { background: '#F1F5F9', color: '#64748B' },
  infoGrid: { display: 'grid', gap: 8 },
  infoItem: { display: 'flex', alignItems: 'flex-start', gap: 8, color: '#334155', fontSize: '0.88rem', lineHeight: 1.45 },
  infoIcon: { color: '#003D7C', flexShrink: 0, marginTop: 1 },
  dias: { display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 },
  diaPill: { background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0', borderRadius: 999, padding: '0.28rem 0.6rem', fontSize: '0.72rem', fontWeight: 800 },
  diaHoje: { background: '#E8F0FB', borderColor: '#BFDBFE', color: '#003D7C' },
  contatos: { display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid #E5E7EB', marginTop: 12, paddingTop: 12 },
  contatoItem: { display: 'inline-flex', alignItems: 'center', gap: 5, color: '#475569', background: '#F8FAFC', borderRadius: 999, padding: '0.35rem 0.65rem', fontSize: '0.78rem', fontWeight: 700 },
}
