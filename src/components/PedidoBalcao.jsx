import { useMemo, useState } from 'react'
import {
  BadgeCheck, CheckCircle2, CreditCard, Minus, PackageOpen, Plus, Search,
  ChevronUp, ShoppingCart, Trash2, UserPlus, UserRoundSearch, X,
} from 'lucide-react'
import { collection, doc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase'
import { useApp } from '../contexts/AppContext'
import { useToast } from '../contexts/hooks/useToast'
import { producaoDisponivelParaVenda, produtoDisponivelParaCardapioDia, produtoLiberadoManualHoje } from '../utils/producao'
import { formatPrice } from '../utils/formatters'
import { nomeParaVinculo } from '../utils/nomes'
import { JANELA_PEDIDO_MS, chaveDiariaPedido, codigoPedido } from '../utils/pedidos'
import { perfisDoUsuario } from '../utils/perfis'
import { useIsMobile } from '../utils/useIsMobile'

const PAGAMENTOS_BASE = [
  { valor: 'Dinheiro', label: 'Dinheiro' },
  { valor: 'PIX', label: 'Pix' },
  { valor: 'Débito', label: 'Cartão / Débito' },
  { valor: 'Crédito', label: 'Cartão / Crédito' },
]

function matriculaNormalizada(valor = '') {
  return String(valor).trim().toLowerCase()
}

function consumirProducoesDaVenda(transaction, refs, snaps, quantidade) {
  let restante = Number(quantidade || 0)
  const consumos = []
  refs.forEach((ref, index) => {
    if (restante <= 0) return
    const snap = snaps[index]
    if (!snap.exists()) return
    const dados = snap.data()
    if (!producaoDisponivelParaVenda(dados)) return
    const disponivel = Math.max(0, Number(dados.quantidadeRestante || 0))
    const usado = Math.min(disponivel, restante)
    if (usado <= 0) return
    const novoRestante = Math.max(0, disponivel - usado)
    const update = {
      quantidadeVendida: Number(dados.quantidadeVendida || 0) + usado,
      quantidadeRestante: novoRestante,
      atualizadoEm: Date.now(),
    }
    if (novoRestante <= 0) update.status = 'Esgotado'
    transaction.update(ref, update)
    consumos.push({ id: ref.id, quantidade: usado })
    restante -= usado
  })
  if (restante > 0) throw new Error('Produto fora do cardapio do dia ou sem producao disponivel.')
  return consumos
}

export default function PedidoBalcao() {
  const { produtos, producaoHoje, usuarios, usuarioLogado, atualizarStatusPedido } = useApp()
  const toast = useToast()
  const isMobile = useIsMobile()
  const isCompact = useIsMobile(1050)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [categoria, setCategoria] = useState('Todos')
  const [tipoCliente, setTipoCliente] = useState('cadastrado')
  const [matricula, setMatricula] = useState('')
  const [nomeAluno, setNomeAluno] = useState('')
  const [alunoEncontrado, setAlunoEncontrado] = useState(null)
  const [buscaAlunoAberta, setBuscaAlunoAberta] = useState(false)
  const [termoAluno, setTermoAluno] = useState('')
  const [pagamento, setPagamento] = useState('PIX')
  const [carrinho, setCarrinho] = useState([])
  const [erro, setErro] = useState('')
  const [finalizando, setFinalizando] = useState(false)
  const [entregandoPedido, setEntregandoPedido] = useState(false)
  const [ultimoPedido, setUltimoPedido] = useState(null)
  const [confirmandoProfessor, setConfirmandoProfessor] = useState(false)
  const [matriculaProfessor, setMatriculaProfessor] = useState('')
  const [erroProfessor, setErroProfessor] = useState('')
  const [carrinhoAberto, setCarrinhoAberto] = useState(false)

  const produtosDisponiveisDia = useMemo(() => produtos
      .map(produto => produtoDisponivelParaCardapioDia(produto, producaoHoje))
      .filter(Boolean),
    [produtos, producaoHoje])

  const categorias = useMemo(() => [
    'Todos',
    ...Array.from(new Set(produtosDisponiveisDia.map(p => p.categoria).filter(Boolean))).sort(),
  ], [produtosDisponiveisDia])

  const produtosFiltrados = useMemo(() => {
    const termo = buscaProduto.trim().toLowerCase()
    return produtosDisponiveisDia
      .filter(p => categoria === 'Todos' || p.categoria === categoria)
      .filter(p => !termo || String(p.nome || '').toLowerCase().includes(termo))
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
  }, [produtosDisponiveisDia, buscaProduto, categoria])

  const alunosBusca = useMemo(() => {
    const termo = termoAluno.trim().toLocaleLowerCase('pt-BR')
    return (usuarios || [])
      .filter(usuario => perfisDoUsuario(usuario).some(perfil => ['aluno', 'professor'].includes(perfil)))
      .filter(usuario => usuario.ativo !== false && usuario.bloqueado !== true)
      .filter(usuario => {
        if (!termo) return true
        return String(usuario.nome || '').toLocaleLowerCase('pt-BR').includes(termo)
          || String(usuario.matricula || '').toLocaleLowerCase('pt-BR').includes(termo)
      })
      .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'))
      .slice(0, 8)
  }, [usuarios, termoAluno])

  const perfilAluno = perfisDoUsuario(alunoEncontrado).includes('professor') ? 'professor' : 'aluno'
  const pagamentos = perfilAluno === 'professor'
    ? [...PAGAMENTOS_BASE, { valor: 'Conta do Professor', label: 'Conta do Professor' }]
    : PAGAMENTOS_BASE
  const total = carrinho.reduce((acc, item) => acc + Number(item.preco || 0) * item.quantidade, 0)
  const totalItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0)
  const matriculaValida = /^[A-Za-z0-9._-]{4,20}$/.test(matricula.trim())
  const matriculaAvulsaValida = !matricula.trim() || matriculaValida
  const nomeCompletoValido = nomeParaVinculo(nomeAluno).split(' ').filter(Boolean).length >= 2
  const clienteValido = tipoCliente === 'avulso'
    ? Boolean(nomeCompletoValido && matriculaAvulsaValida)
    : Boolean(matriculaValida && nomeAluno.trim() && alunoEncontrado)
  const podeFinalizar = Boolean(clienteValido && carrinho.length && !finalizando)

  function alterarTipoCliente(tipo) {
    setTipoCliente(tipo)
    setMatricula('')
    setNomeAluno('')
    setAlunoEncontrado(null)
    setBuscaAlunoAberta(false)
    setTermoAluno('')
    setPagamento('PIX')
    setErro('')
  }

  function abrirBuscaAluno() {
    setTermoAluno(matricula)
    setBuscaAlunoAberta(true)
    setErro('')
  }

  function selecionarAluno(usuario) {
    setMatricula(String(usuario.matricula || ''))
    setNomeAluno(usuario.nome || '')
    setAlunoEncontrado(usuario)
    setPagamento('PIX')
    setBuscaAlunoAberta(false)
    setTermoAluno('')
    setErro('')
  }

  function buscarAluno(valor = matricula) {
    if (tipoCliente !== 'cadastrado') return
    const alvo = matriculaNormalizada(valor)
    const encontrado = (usuarios || []).find(u => matriculaNormalizada(u.matricula) === alvo)
    const alunoValido = encontrado && perfisDoUsuario(encontrado).some(perfil => ['aluno', 'professor'].includes(perfil)) ? encontrado : null
    setAlunoEncontrado(alunoValido)
    if (alunoValido) setNomeAluno(alunoValido.nome || '')
    if (!alunoValido && alvo) setNomeAluno('')
    if (!alunoValido && pagamento === 'Conta do Professor') setPagamento('PIX')
    setErro(alunoValido || !alvo ? '' : 'Aluno não encontrado. Confira a matrícula ou escolha “Sem cadastro”.')
  }

  function alterarMatricula(valor) {
    setMatricula(valor)
    if (tipoCliente === 'avulso') {
      setErro('')
      return
    }
    if (matriculaNormalizada(valor) !== matriculaNormalizada(alunoEncontrado?.matricula)) {
      setAlunoEncontrado(null)
      setNomeAluno('')
      if (pagamento === 'Conta do Professor') setPagamento('PIX')
    }
    setErro('')
  }

  function adicionarProduto(produto) {
    const estoque = Math.max(0, Number(produto.estoque || 0))
    if (produto.disponivel === false) {
      setErro('Produto indisponível para venda.')
      return
    }
    if (estoque <= 0) {
      setErro('Produto fora de estoque.')
      return
    }
    const existente = carrinho.find(i => String(i.id) === String(produto.id))
    if (existente && existente.quantidade >= Math.min(estoque, 20)) {
      setErro('Não há estoque suficiente para este produto.')
      return
    }
    setErro('')
    setCarrinho(atual => existente
      ? atual.map(i => String(i.id) === String(produto.id) ? { ...i, quantidade: i.quantidade + 1 } : i)
      : [...atual, {
        id: produto.id,
        nome: produto.nome,
        preco: Number(produto.preco || 0),
        estoque,
        quantidade: 1,
        producaoDiaIds: produto.producaoDiaIds || [],
      }])
  }

  function alterarQuantidade(item, delta) {
    const produto = produtos.find(p => String(p.id) === String(item.id))
    const estoque = Math.max(0, Number(produto?.estoque || 0))
    const nova = item.quantidade + delta
    if (nova <= 0) {
      setCarrinho(atual => atual.filter(i => String(i.id) !== String(item.id)))
      return
    }
    if (nova > Math.min(estoque, 20)) {
      setErro('Não há estoque suficiente para este produto.')
      return
    }
    setErro('')
    setCarrinho(atual => atual.map(i => String(i.id) === String(item.id) ? { ...i, quantidade: nova } : i))
  }

  async function finalizarPedido() {
    if (tipoCliente === 'cadastrado' && !matriculaValida) {
      setErro('Informe uma matrícula válida.')
      return
    }
    if (tipoCliente === 'avulso' && !matriculaAvulsaValida) {
      setErro('A matrícula informada é inválida. Corrija ou deixe o campo vazio.')
      return
    }
    if (tipoCliente === 'cadastrado' && !alunoEncontrado) {
      setErro('Busque e selecione um aluno cadastrado antes de finalizar.')
      return
    }
    if (!nomeAluno.trim()) {
      setErro(tipoCliente === 'avulso' ? 'Informe o nome do aluno.' : 'Não foi possível identificar o aluno.')
      return
    }
    if (tipoCliente === 'avulso' && !nomeCompletoValido) {
      setErro('Informe o nome completo, incluindo o sobrenome.')
      return
    }
    if (!carrinho.length) {
      setErro('Adicione pelo menos um produto ao pedido.')
      return
    }

    setFinalizando(true)
    setErro('')
    try {
      if (!usuarioLogado?.uid) throw new Error('Sua sessão expirou. Entre novamente.')
      const criadoEm = Date.now()
      const chaveDiaria = chaveDiariaPedido(criadoEm)
      const pedidoRef = doc(collection(db, 'pedidos'))
      const contadorRef = doc(db, 'contadoresPedidos', chaveDiaria)
      const itensComRefs = carrinho.map(item => {
        const produtoDia = produtosDisponiveisDia.find(produto => String(produto.id) === String(item.id))
        return {
          ...item,
          ref: doc(db, 'produtos', String(item.id)),
          producaoRefs: (produtoDia?.producaoDiaIds || item.producaoDiaIds || []).map(id => doc(db, 'producaoDiaria', String(id))),
        }
      })

      const pedidoCriado = await runTransaction(db, async transaction => {
        const [contadorSnap, ...produtosSnap] = await Promise.all([
          transaction.get(contadorRef),
          ...itensComRefs.map(item => transaction.get(item.ref)),
        ])
        const producaoSnapsPorItem = await Promise.all(
          itensComRefs.map(item => Promise.all(item.producaoRefs.map(ref => transaction.get(ref))))
        )

        const itens = produtosSnap.map((snap, index) => {
          const entrada = itensComRefs[index]
          if (!snap.exists()) throw new Error(`O item ${entrada.nome} não está mais disponível.`)
          const produto = snap.data()
          const estoqueAtual = Math.max(0, Number(produto.estoque || 0))
          if (produto.disponivel === false || estoqueAtual <= 0) throw new Error(`Produto fora de estoque: ${produto.nome}.`)
          if (estoqueAtual < entrada.quantidade) throw new Error(`Não há estoque suficiente para ${produto.nome}.`)
          const quantidadeProducao = producaoSnapsPorItem[index]
            .filter(snapProducao => snapProducao.exists() && producaoDisponivelParaVenda(snapProducao.data()))
            .reduce((total, snapProducao) => total + Math.max(0, Number(snapProducao.data().quantidadeRestante || 0)), 0)
          if (!produtoLiberadoManualHoje(produto) && quantidadeProducao < entrada.quantidade) throw new Error(`${entrada.nome} nao esta disponivel no cardapio do dia.`)
          return {
            produtoId: snap.id,
            nome: produto.nome || entrada.nome,
            quantidade: entrada.quantidade,
            preco: Math.max(0, Number(produto.preco || 0)),
            estoqueAtual,
            disponivel: produto.disponivel !== false,
            ref: entrada.ref,
            producaoDiaIds: entrada.producaoRefs.map(ref => ref.id),
          }
        })

        const numero = Number(contadorSnap.data()?.ultimoNumero || 0) + 1
        if (numero > 9999) throw new Error('O limite diário de pedidos foi atingido.')
        const horario = new Date(criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        const perfil = perfisDoUsuario(alunoEncontrado).includes('professor') ? 'professor' : 'aluno'
        const pagamentoPendente = pagamento === 'Conta do Professor'
        const novoPedido = {
          id: pedidoRef.id,
          numero,
          chaveDiaria,
          uid: alunoEncontrado?.uid || '',
          aluno: alunoEncontrado?.nome || nomeAluno.trim(),
          nomeVinculo: nomeParaVinculo(alunoEncontrado?.nome || nomeAluno),
          matricula: matricula.trim(),
          alunoPerfil: perfil,
          alunoCadastrado: tipoCliente === 'cadastrado' && Boolean(alunoEncontrado),
          clienteTipo: tipoCliente,
          itens: itens.map(({ produtoId, nome, quantidade, preco, producaoDiaIds }) => ({ produtoId, nome, quantidade, preco, producaoDiaIds })),
          total: itens.reduce((acc, item) => acc + item.preco * item.quantidade, 0),
          status: 'Recebido',
          statusKey: 'em_processo',
          origem: 'balcao',
          origemLabel: 'Balcão',
          lancadoPor: {
            uid: usuarioLogado.uid,
            nome: usuarioLogado.nome || 'Vendedor',
            matricula: usuarioLogado.matricula || '',
            perfil: 'vendedor',
          },
          lancadoPorNome: usuarioLogado.nome || 'Vendedor',
          formaPagamento: pagamento,
          pagamento,
          pagamentoStatus: pagamentoPendente ? 'pendente' : 'pago',
          pago: !pagamentoPendente,
          pagoEm: pagamentoPendente ? null : criadoEm,
          horarioPedido: horario,
          horarioRetirada: horario,
          horarioRetiradaEm: criadoEm,
          inicioContagemEm: criadoEm,
          cancelavelAte: criadoEm + JANELA_PEDIDO_MS,
          criadoEm,
        }

        transaction.set(contadorRef, { ultimoNumero: numero, chaveDiaria, atualizadoEm: criadoEm })
        itens.forEach((item, index) => {
          const novoEstoque = Math.max(0, item.estoqueAtual - item.quantidade)
          const producaoConsumo = itensComRefs[index].producaoRefs.length
            ? consumirProducoesDaVenda(transaction, itensComRefs[index].producaoRefs, producaoSnapsPorItem[index], item.quantidade)
            : []
          novoPedido.itens[index].producaoConsumo = producaoConsumo
          transaction.update(item.ref, { estoque: novoEstoque })
        })
        transaction.set(pedidoRef, novoPedido)
        return novoPedido
      })

      setUltimoPedido(pedidoCriado)
      setCarrinho([])
      setCarrinhoAberto(false)
      setMatricula('')
      setNomeAluno('')
      setAlunoEncontrado(null)
      setTipoCliente('cadastrado')
      setPagamento('PIX')
      toast('Pedido criado com sucesso.', 'success')
    } catch (e) {
      setErro(e.message || 'Não foi possível criar o pedido no balcão.')
      toast(e.message || 'Não foi possível criar o pedido no balcão.', 'error')
    } finally {
      setFinalizando(false)
    }
  }

  async function concluirEntregaUltimoPedido() {
    if (!ultimoPedido?.id || ultimoPedido.status === 'Entregue') return
    setEntregandoPedido(true)
    setErro('')
    try {
      const resultado = await atualizarStatusPedido(ultimoPedido.id, 'Entregue', ultimoPedido)
      if (resultado?.erro) throw new Error(resultado.erro)
      setUltimoPedido(prev => ({ ...prev, status: 'Entregue', statusKey: 'retirado', retiradoEm: Date.now() }))
      setConfirmandoProfessor(false)
      setMatriculaProfessor('')
      setErroProfessor('')
      toast('Pedido marcado como entregue.', 'success')
    } catch (e) {
      setErro(e.message || 'Não foi possível marcar o pedido como entregue.')
    } finally {
      setEntregandoPedido(false)
    }
  }

  function entregarUltimoPedido() {
    const formaPagamento = String(ultimoPedido?.formaPagamento || ultimoPedido?.pagamento || '').trim().toLocaleLowerCase('pt-BR')
    if (formaPagamento === 'conta do professor') {
      setMatriculaProfessor('')
      setErroProfessor('')
      setConfirmandoProfessor(true)
      return
    }
    concluirEntregaUltimoPedido()
  }

  function confirmarEntregaProfessor(e) {
    e.preventDefault()
    const matriculaEsperada = String(ultimoPedido?.matricula || '').trim()
    if (!matriculaProfessor.trim()) {
      setErroProfessor('Informe a matrícula do professor.')
      return
    }
    if (matriculaProfessor.trim() !== matriculaEsperada) {
      setErroProfessor('A matrícula informada não corresponde ao professor deste pedido.')
      return
    }
    concluirEntregaUltimoPedido()
  }

  function renderCarrinho(compacto = false) {
    return (
      <aside style={{ ...s.carrinho, position: compacto ? 'static' : 'sticky', padding: compacto ? 12 : 15, minHeight: compacto ? 0 : 300 }}>
        <div style={{ ...s.carrinhoTopo, paddingRight: compacto ? 38 : 0 }}>
          <div style={s.carrinhoTitulo}><ShoppingCart size={19} /> Carrinho do pedido</div>
          <span style={s.contadorCarrinho}>{totalItens}</span>
        </div>
        {!carrinho.length ? (
          <div style={s.carrinhoVazio}>Selecione os produtos do pedido.</div>
        ) : (
          <div style={{ ...s.itensCarrinho, maxHeight: compacto ? '38vh' : 390 }}>
            {carrinho.map(item => (
              <div key={item.id} style={s.itemCarrinho}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <strong style={s.itemNome}>{item.nome}</strong>
                  <span style={s.itemPreco}>{formatPrice(item.preco)} cada</span>
                </div>
                <div style={s.quantidade}>
                  <button type="button" onClick={() => alterarQuantidade(item, -1)} style={s.qtdBtn} aria-label={`Diminuir ${item.nome}`}><Minus size={14} /></button>
                  <strong>{item.quantidade}</strong>
                  <button type="button" onClick={() => alterarQuantidade(item, 1)} style={s.qtdBtn} aria-label={`Aumentar ${item.nome}`}><Plus size={14} /></button>
                </div>
                <strong style={s.subtotal}>{formatPrice(item.preco * item.quantidade)}</strong>
                <button type="button" onClick={() => setCarrinho(atual => atual.filter(i => String(i.id) !== String(item.id)))} style={s.removerBtn} title="Remover item" aria-label={`Remover ${item.nome}`}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={s.total}><span>Total</span><strong>{formatPrice(total)}</strong></div>
        <button type="button" onClick={finalizarPedido} disabled={!podeFinalizar} style={{ ...s.finalizar, opacity: podeFinalizar ? 1 : 0.55, cursor: podeFinalizar ? 'pointer' : 'not-allowed' }}>
          <CreditCard size={18} /> {finalizando ? 'Finalizando...' : 'Finalizar pedido no balcão'}
        </button>
      </aside>
    )
  }

  return (
    <div style={{ ...s.page, paddingBottom: isCompact ? 70 : 0 }}>
      <div style={s.tituloLinha}>
        <div>
          <h2 style={s.titulo}>Pedido no Balcão</h2>
          <p style={s.subtitulo}>Monte e finalize a compra presencial.</p>
        </div>
        {ultimoPedido && (
          <div style={s.sucessoPedido}>
            <span style={s.sucessoTexto}>
              <CheckCircle2 size={18} /> Pedido {codigoPedido(ultimoPedido)} {ultimoPedido.status === 'Entregue' ? 'entregue' : 'criado'}
            </span>
            {ultimoPedido.status !== 'Entregue' && (
              <button type="button" onClick={entregarUltimoPedido} disabled={entregandoPedido} style={s.entregarAgoraBtn}>
                <CheckCircle2 size={15} /> {entregandoPedido ? 'Concluindo...' : 'Marcar como entregue'}
              </button>
            )}
          </div>
        )}
      </div>

      {confirmandoProfessor && (
        <div style={s.modalOverlay} role="dialog" aria-modal="true" aria-labelledby="confirmar-professor-titulo">
          <form onSubmit={confirmarEntregaProfessor} style={s.modalProfessor}>
            <div style={s.modalProfessorTopo}>
              <div>
                <h3 id="confirmar-professor-titulo" style={s.modalProfessorTitulo}>Confirmar entrega</h3>
                <p style={s.modalProfessorMeta}>Pedido {codigoPedido(ultimoPedido)} · Conta do Professor</p>
              </div>
              <button type="button" onClick={() => setConfirmandoProfessor(false)} style={s.fecharBuscaBtn} aria-label="Fechar">
                <X size={16} />
              </button>
            </div>
            <label style={s.label} htmlFor="matricula-professor-entrega">Matrícula do professor</label>
            <input
              id="matricula-professor-entrega"
              value={matriculaProfessor}
              onChange={e => { setMatriculaProfessor(e.target.value); setErroProfessor('') }}
              style={s.input}
              placeholder="Digite a matrícula"
              inputMode="numeric"
              autoFocus
            />
            {erroProfessor && <div role="alert" style={s.erro}>{erroProfessor}</div>}
            <button type="submit" disabled={entregandoPedido} style={s.confirmarProfessorBtn}>
              <CheckCircle2 size={16} /> {entregandoPedido ? 'Concluindo...' : 'Confirmar entrega'}
            </button>
          </form>
        </div>
      )}

      <section style={{ ...s.identificacao, padding: isCompact ? 12 : 16, gap: isCompact ? 12 : 15 }}>
        <div style={s.identificacaoTopo}>
          <div>
            <strong style={s.identificacaoTitulo}>Identificação do cliente</strong>
            <span style={s.identificacaoMeta}>{tipoCliente === 'cadastrado' ? 'Localize pelo cadastro do sistema' : 'Venda para aluno sem conta no aplicativo'}</span>
          </div>
          <div style={{ ...s.tipoCliente, width: isMobile ? '100%' : 'auto' }} role="group" aria-label="Tipo de cliente">
            <button
              type="button"
              onClick={() => alterarTipoCliente('cadastrado')}
              style={{ ...s.tipoClienteBtn, flex: isMobile ? 1 : 'initial', ...(tipoCliente === 'cadastrado' ? s.tipoClienteAtivo : {}) }}
            >
              <BadgeCheck size={17} /> Com cadastro
            </button>
            <button
              type="button"
              onClick={() => alterarTipoCliente('avulso')}
              style={{ ...s.tipoClienteBtn, flex: isMobile ? 1 : 'initial', ...(tipoCliente === 'avulso' ? s.tipoClienteAtivo : {}) }}
            >
              <UserPlus size={17} /> Sem cadastro
            </button>
          </div>
        </div>

        <div style={{ ...s.identificacaoCampos, gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div style={s.campoMatricula}>
            <label style={s.label}>{tipoCliente === 'cadastrado' ? 'Buscar por matrícula' : 'Matrícula (opcional)'}</label>
            <div style={s.buscaMatricula}>
              <input
                value={matricula}
                onChange={e => alterarMatricula(e.target.value)}
                onBlur={() => buscarAluno()}
                style={s.input}
                placeholder={tipoCliente === 'cadastrado' ? 'Ex.: 2024001' : 'Deixe vazio se não souber'}
                autoComplete="off"
              />
              {tipoCliente === 'cadastrado' && (
                <button type="button" onClick={abrirBuscaAluno} style={s.buscarAlunoBtn} title="Busca rápida de alunos" aria-label="Abrir busca rápida de alunos">
                  <UserRoundSearch size={18} />
                </button>
              )}
            </div>
            {tipoCliente === 'cadastrado' && buscaAlunoAberta && (
              <div style={s.buscaAlunoPainel}>
                <div style={s.buscaAlunoTopo}>
                  <strong style={s.buscaAlunoTitulo}>Busca rápida</strong>
                  <button type="button" onClick={() => setBuscaAlunoAberta(false)} style={s.fecharBuscaBtn} aria-label="Fechar busca">
                    <X size={16} />
                  </button>
                </div>
                <div style={s.buscaAlunoInputBox}>
                  <Search size={16} color="#64748B" />
                  <input
                    value={termoAluno}
                    onChange={e => setTermoAluno(e.target.value)}
                    style={s.buscaAlunoInput}
                    placeholder="Nome ou matrícula"
                    autoFocus
                  />
                </div>
                <div style={s.alunosLista}>
                  {alunosBusca.map(usuario => (
                    <button key={usuario.uid || usuario.matricula} type="button" onClick={() => selecionarAluno(usuario)} style={s.alunoOpcao}>
                      <span style={s.alunoAvatar}>{String(usuario.nome || '?').trim().charAt(0).toUpperCase()}</span>
                      <span style={s.alunoDados}>
                        <strong style={s.alunoNome}>{usuario.nome || 'Sem nome'}</strong>
                        <span style={s.alunoMatricula}>{usuario.matricula || 'Sem matrícula'} · {perfisDoUsuario(usuario).includes('professor') ? 'Professor' : 'Aluno'}</span>
                      </span>
                    </button>
                  ))}
                  {alunosBusca.length === 0 && <div style={s.nenhumAluno}>Nenhum cadastro encontrado.</div>}
                </div>
              </div>
            )}
            {tipoCliente === 'avulso' && <span style={s.avulso}>Não exige cadastro nem matrícula.</span>}
          </div>
          <div style={s.campo}>
            <label style={s.label}>Nome do aluno</label>
            <input
              value={nomeAluno}
              onChange={e => { setNomeAluno(e.target.value); setErro('') }}
              style={{ ...s.input, ...(alunoEncontrado ? s.inputConfirmado : {}) }}
              disabled={tipoCliente === 'cadastrado'}
              placeholder={tipoCliente === 'cadastrado' ? 'Preenchido após a busca' : 'Nome completo'}
            />
            {alunoEncontrado && <span style={s.encontrado}><BadgeCheck size={13} /> {perfilAluno === 'professor' ? 'Professor identificado' : 'Aluno identificado'}</span>}
          </div>
          <div style={s.campo}>
            <label style={s.label}>Forma de pagamento</label>
            <select value={pagamento} onChange={e => setPagamento(e.target.value)} style={s.input}>
              {pagamentos.map(op => <option key={op.valor} value={op.valor}>{op.label}</option>)}
            </select>
          </div>
        </div>
      </section>

      {erro && <div role="alert" style={s.erro}>{erro}</div>}

      <div style={{ ...s.conteudo, gridTemplateColumns: isCompact ? '1fr' : 'minmax(440px, 1fr) minmax(280px, 320px)' }}>
        <section style={s.catalogo}>
          <div style={s.filtros}>
            <div style={s.buscaProduto}>
              <Search size={17} color="#64748B" />
              <input value={buscaProduto} onChange={e => setBuscaProduto(e.target.value)} placeholder="Buscar produto" style={s.buscaInput} />
            </div>
            <div style={s.categorias}>
              {categorias.map(cat => (
                <button key={cat} type="button" onClick={() => setCategoria(cat)} style={{ ...s.categoriaBtn, ...(categoria === cat ? s.categoriaAtiva : {}) }}>
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div style={{ ...s.produtosGrid, gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {produtosFiltrados.map(produto => {
              const indisponivel = produto.disponivel === false
              const semEstoque = Number(produto.estoque || 0) <= 0
              const bloqueado = indisponivel || semEstoque
              const quantidadeNoCarrinho = carrinho.find(item => String(item.id) === String(produto.id))?.quantidade || 0
              return (
                <article key={produto.id} style={{ ...s.produto, ...(quantidadeNoCarrinho ? s.produtoSelecionado : {}), opacity: bloqueado ? 0.62 : 1 }}>
                  <div style={s.produtoImagem}>
                    {produto.foto
                      ? <img src={produto.foto} alt={produto.nome} style={s.imagem} />
                      : <span style={{ fontSize: 28 }}>{produto.emoji || '🍴'}</span>}
                  </div>
                  <div style={s.produtoInfo}>
                    <div style={s.produtoNomeLinha}>
                      <strong style={s.produtoNome}>{produto.nome}</strong>
                      {quantidadeNoCarrinho > 0 && <span style={s.noCarrinho}>{quantidadeNoCarrinho} no carrinho</span>}
                    </div>
                    <span style={s.produtoMeta}>{produto.categoria} · {produto.estoque || 0} un</span>
                    <strong style={s.preco}>{formatPrice(produto.preco || 0)}</strong>
                  </div>
                  <button type="button" onClick={() => adicionarProduto(produto)} disabled={bloqueado} style={{ ...s.adicionarBtn, opacity: bloqueado ? 0.55 : 1 }}>
                    <Plus size={17} /> {semEstoque ? 'Sem estoque' : indisponivel ? 'Indisponível' : 'Adicionar'}
                  </button>
                </article>
              )
            })}
            {!produtosFiltrados.length && <div style={s.vazio}><PackageOpen size={30} /> Nenhum produto encontrado.</div>}
          </div>
        </section>

        {!isCompact && renderCarrinho()}
      </div>

      {isCompact && (
        <>
          <button type="button" style={{ ...s.mobileCartBar, bottom: isMobile ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 10 }} onClick={() => setCarrinhoAberto(true)} aria-label="Abrir carrinho do pedido">
            <span style={s.mobileCartInfo}><ShoppingCart size={18} /><strong>{totalItens}</strong> {totalItens === 1 ? 'item' : 'itens'}</span>
            <strong>{formatPrice(total)}</strong>
            <ChevronUp size={18} />
          </button>
          {carrinhoAberto && (
            <>
              <button type="button" style={s.cartBackdrop} onClick={() => setCarrinhoAberto(false)} aria-label="Fechar carrinho" />
              <div style={{ ...s.cartSheet, bottom: isMobile ? 'calc(64px + env(safe-area-inset-bottom, 0px))' : 10 }} role="dialog" aria-modal="true" aria-label="Carrinho do pedido">
                <button type="button" onClick={() => setCarrinhoAberto(false)} style={s.cartSheetClose} aria-label="Fechar carrinho"><X size={18} /></button>
                {renderCarrinho(true)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

const s = {
  page: { display: 'flex', flexDirection: 'column', gap: 14 },
  tituloLinha: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  titulo: { margin: 0, color: '#0F172A', fontSize: '1.25rem', fontWeight: 900 },
  subtitulo: { margin: '4px 0 0', color: '#64748B', fontSize: '0.86rem' },
  sucessoPedido: { display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', borderRadius: 8, padding: '0.45rem 0.55rem 0.45rem 0.75rem', fontWeight: 800, fontSize: '0.84rem' },
  sucessoTexto: { display: 'inline-flex', alignItems: 'center', gap: 7 },
  entregarAgoraBtn: { minHeight: 34, border: 'none', borderRadius: 6, padding: '0 0.7rem', background: '#15803D', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer' },
  modalOverlay: { position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15, 23, 42, 0.54)', padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modalProfessor: { width: '100%', maxWidth: 420, background: '#fff', borderRadius: 8, padding: 18, display: 'flex', flexDirection: 'column', gap: 11, boxShadow: '0 24px 60px rgba(15, 23, 42, 0.28)' },
  modalProfessorTopo: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 2 },
  modalProfessorTitulo: { margin: 0, color: '#0F172A', fontSize: '1rem', fontWeight: 900 },
  modalProfessorMeta: { margin: '4px 0 0', color: '#64748B', fontSize: '0.76rem' },
  confirmarProfessorBtn: { minHeight: 44, border: 'none', borderRadius: 7, background: '#003D7C', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer', marginTop: 2 },
  identificacao: { display: 'flex', flexDirection: 'column', gap: 15, background: '#fff', border: '1px solid #D8E1EC', borderRadius: 8, padding: 16 },
  identificacaoTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', paddingBottom: 13, borderBottom: '1px solid #E8EDF3' },
  identificacaoTitulo: { display: 'block', color: '#0F172A', fontSize: '0.95rem', fontWeight: 900 },
  identificacaoMeta: { display: 'block', color: '#64748B', fontSize: '0.76rem', marginTop: 3 },
  identificacaoCampos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 },
  tipoCliente: { display: 'flex', alignItems: 'center', background: '#EEF2F7', borderRadius: 8, padding: 4, gap: 4 },
  tipoClienteBtn: { minHeight: 38, border: 'none', borderRadius: 6, padding: '0 0.8rem', background: 'transparent', color: '#64748B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer' },
  tipoClienteAtivo: { background: '#fff', color: '#003D7C', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.14)' },
  campo: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  campoMatricula: { position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  label: { color: '#475569', fontSize: '0.8rem', fontWeight: 800 },
  input: { width: '100%', boxSizing: 'border-box', minHeight: 44, border: '1px solid #C5D1E0', borderRadius: 7, padding: '0 0.8rem', color: '#0F172A', background: '#fff', fontFamily: 'inherit', fontWeight: 700, outlineColor: '#003D7C' },
  inputConfirmado: { borderColor: '#86CDA0', background: '#F3FBF6' },
  buscaMatricula: { display: 'flex', gap: 6 },
  buscarAlunoBtn: { width: 44, minWidth: 44, border: 'none', borderRadius: 7, background: '#003D7C', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  buscaAlunoPainel: { position: 'absolute', zIndex: 40, top: 'calc(100% + 7px)', left: 0, width: 420, maxWidth: 'calc(100vw - 32px)', background: '#fff', border: '1px solid #C5D1E0', borderRadius: 8, boxShadow: '0 14px 34px rgba(15, 23, 42, 0.18)', padding: 10 },
  buscaAlunoTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '1px 2px 8px' },
  buscaAlunoTitulo: { color: '#0F172A', fontSize: '0.84rem', fontWeight: 900 },
  fecharBuscaBtn: { width: 30, height: 30, border: 'none', borderRadius: 6, background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  buscaAlunoInputBox: { minHeight: 40, display: 'flex', alignItems: 'center', gap: 7, border: '1px solid #C5D1E0', borderRadius: 7, padding: '0 0.7rem', marginBottom: 8 },
  buscaAlunoInput: { flex: 1, minWidth: 0, border: 'none', outline: 'none', color: '#0F172A', background: 'transparent', fontFamily: 'inherit', fontWeight: 700 },
  alunosLista: { display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 280, overflowY: 'auto' },
  alunoOpcao: { width: '100%', minHeight: 52, border: 'none', borderRadius: 7, background: '#fff', padding: '6px 7px', display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' },
  alunoAvatar: { width: 34, height: 34, flexShrink: 0, borderRadius: 7, background: '#E8F0FB', color: '#003D7C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.82rem', fontWeight: 900 },
  alunoDados: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  alunoNome: { color: '#0F172A', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  alunoMatricula: { color: '#64748B', fontSize: '0.7rem' },
  nenhumAluno: { padding: '1.1rem 0.6rem', textAlign: 'center', color: '#94A3B8', fontSize: '0.78rem', fontWeight: 700 },
  avulso: { color: '#B45309', fontSize: '0.75rem', fontWeight: 700 },
  encontrado: { color: '#15803D', fontSize: '0.75rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 },
  conteudo: { display: 'grid', gap: 16, alignItems: 'start' },
  catalogo: { minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 },
  filtros: { display: 'flex', flexDirection: 'column', gap: 10 },
  buscaProduto: { minHeight: 40, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #C5D1E0', borderRadius: 7, padding: '0 0.72rem' },
  buscaInput: { flex: 1, minWidth: 0, border: 'none', outline: 'none', fontFamily: 'inherit', fontWeight: 700 },
  categorias: { display: 'flex', gap: 7, overflowX: 'auto', padding: '1px 1px 3px', scrollbarWidth: 'none' },
  categoriaBtn: { flexShrink: 0, border: '1px solid #CBD5E1', background: '#fff', color: '#64748B', borderRadius: 7, padding: '0.45rem 0.75rem', fontFamily: 'inherit', fontWeight: 800, cursor: 'pointer' },
  categoriaAtiva: { background: '#003D7C', borderColor: '#003D7C', color: '#fff' },
  produtosGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 10 },
  produto: { display: 'grid', gridTemplateColumns: '54px minmax(0, 1fr)', gap: 10, background: '#fff', border: '1px solid #D8E1EC', borderRadius: 8, padding: 11, minWidth: 0, transition: 'border-color 160ms ease, box-shadow 160ms ease' },
  produtoSelecionado: { borderColor: '#F47920', boxShadow: '0 0 0 1px rgba(244, 121, 32, 0.16)' },
  produtoImagem: { width: 54, height: 54, borderRadius: 7, overflow: 'hidden', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  imagem: { width: '100%', height: '100%', objectFit: 'cover' },
  produtoInfo: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  produtoNomeLinha: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, minWidth: 0 },
  produtoNome: { color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
  noCarrinho: { flexShrink: 0, background: '#FFF0E5', color: '#C2410C', borderRadius: 5, padding: '2px 5px', fontSize: '0.62rem', fontWeight: 900 },
  produtoMeta: { color: '#94A3B8', fontSize: '0.72rem', marginTop: 2 },
  preco: { color: '#003D7C', fontSize: '0.88rem', marginTop: 4 },
  adicionarBtn: { gridColumn: '1 / -1', minHeight: 38, border: 'none', borderRadius: 7, background: '#F47920', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer' },
  vazio: { gridColumn: '1 / -1', minHeight: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#94A3B8', background: '#fff', border: '1px dashed #CBD5E1', borderRadius: 8, fontWeight: 700 },
  carrinho: { position: 'sticky', top: 84, minHeight: 300, background: '#fff', border: '1px solid #D8E1EC', borderRadius: 8, padding: 15, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 },
  carrinhoTopo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  carrinhoTitulo: { display: 'flex', alignItems: 'center', gap: 7, color: '#0F172A', fontWeight: 900 },
  contadorCarrinho: { minWidth: 26, height: 26, borderRadius: 6, background: '#E8F0FB', color: '#003D7C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.76rem', fontWeight: 900 },
  carrinhoVazio: { flex: 1, minHeight: 96, background: '#F8FAFC', borderRadius: 7, padding: '1.4rem 0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#94A3B8', fontSize: '0.82rem' },
  itensCarrinho: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 390, overflowY: 'auto' },
  itemCarrinho: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 7, alignItems: 'center', borderBottom: '1px solid #F1F5F9', paddingBottom: 9 },
  itemNome: { display: 'block', color: '#0F172A', fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemPreco: { display: 'block', color: '#94A3B8', fontSize: '0.7rem' },
  quantidade: { display: 'flex', alignItems: 'center', gap: 7 },
  qtdBtn: { width: 28, height: 28, border: 'none', borderRadius: 8, background: '#E8F0FB', color: '#003D7C', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  subtotal: { color: '#003D7C', fontSize: '0.82rem' },
  removerBtn: { justifySelf: 'end', border: 'none', background: '#FEE2E2', color: '#DC2626', width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  erro: { background: '#FFF1F2', color: '#B91C1C', border: '1px solid #FDA4AF', borderRadius: 7, padding: '0.65rem 0.75rem', fontSize: '0.8rem', fontWeight: 700 },
  total: { borderTop: '1px solid #E2E8F0', paddingTop: 12, display: 'flex', justifyContent: 'space-between', color: '#0F172A', fontSize: '1rem' },
  finalizar: { minHeight: 48, border: 'none', borderRadius: 7, background: '#F47920', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', fontWeight: 900, cursor: 'pointer' },
  mobileCartBar: { position: 'fixed', left: 8, right: 8, zIndex: 130, minHeight: 52, maxWidth: 640, margin: '0 auto', border: 'none', borderRadius: 10, padding: '0 0.85rem', background: '#003D7C', color: '#fff', boxShadow: '0 8px 24px rgba(0,61,124,0.28)', display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 10, fontFamily: 'inherit' },
  mobileCartInfo: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, fontSize: '0.78rem' },
  cartBackdrop: { position: 'fixed', inset: 0, zIndex: 220, border: 'none', background: 'rgba(15,23,42,0.52)', backdropFilter: 'blur(2px)' },
  cartSheet: { position: 'fixed', left: 8, right: 8, zIndex: 230, maxWidth: 480, maxHeight: 'min(74dvh, 620px)', margin: '0 auto', overflowY: 'auto', borderRadius: 12, background: '#fff', boxShadow: '0 -16px 48px rgba(15,23,42,0.26)' },
  cartSheetClose: { position: 'absolute', top: 8, right: 8, zIndex: 2, width: 32, height: 32, borderRadius: 8, background: '#F1F5F9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}
