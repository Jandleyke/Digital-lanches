import { useState, useMemo, useCallback } from 'react'
import Layout from '../../components/Layout'
import { useApp } from '../../contexts/AppContext'
import { categorias } from '../../data/mockData'
import { useIsMobile } from '../../utils/useIsMobile'
import { UtensilsCrossed, Flame, Search, RefreshCw, Trophy, Tags } from 'lucide-react'
import AvisosBanner from '../../components/AvisosBanner'
import LanchoneteInfoCard from '../../components/LanchoneteInfoCard'
import { produtoDisponivelNoDia } from '../../utils/cardapioDias'

const GRADIENTS = [
  'linear-gradient(135deg,#FF6B35,#F7C59F)',
  'linear-gradient(135deg,#3B82F6,#93C5FD)',
  'linear-gradient(135deg,#22C55E,#86EFAC)',
  'linear-gradient(135deg,#A855F7,#DDD6FE)',
  'linear-gradient(135deg,#EF4444,#FCA5A5)',
  'linear-gradient(135deg,#F59E0B,#FDE68A)',
]

function ProdutoCard({ produto, onAdd, isFav, onFav, adicionado, isMobile, disabled, alergiasUsuario, onClick, destaque, avaliacao }) {
  const [hover, setHover] = useState(false)
  const isAdded = adicionado === produto.id
  const isOutOfStock = !produto.disponivel || produto.estoque <= 0
  const grad = GRADIENTS[produto.id % GRADIENTS.length]
  const imgHeight = isMobile ?120 : 170

  const userAllergens = alergiasUsuario || []
  const prodAllergens = produto.alergenios || []
  const temAlergia = prodAllergens.some(a => userAllergens.includes(a))
  const estoqueBaixo = produto.estoqueBaixo > 0 && produto.estoque > 0 && produto.estoque <= produto.estoqueBaixo

  return (
    <div
      style={{
        ...s.card,
        transform: hover && produto.disponivel ?'translateY(-4px)' : 'none',
        boxShadow: hover && produto.disponivel ?'0 12px 32px rgba(0,0,0,0.15)' : '0 2px 12px rgba(0,0,0,0.08)',
        filter: isOutOfStock ?'grayscale(0.6)' : 'none',
        border: temAlergia ?'2px solid #FCA5A5' : estoqueBaixo ?'2px solid #FCD34D' : '2px solid transparent',
        cursor: 'pointer',
      }}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{ ...s.imgBox, background: produto.foto ?'transparent' : grad, height: imgHeight }}>
        {produto.foto
          ?<img src={produto.foto} alt={produto.nome} style={s.imgFoto} />
          : <UtensilsCrossed size={isMobile ?36 : 48} color="rgba(255,255,255,0.75)" strokeWidth={1.5} />
        }
        {produto.foto && <div style={s.imgOverlay} />}
        {(destaque || temAlergia || estoqueBaixo) && (
          <div style={s.topBadges}>
            {destaque && <div style={s.promoBadge}><Tags size={11} /> Promoção</div>}
            {temAlergia ?(
              <div style={s.alertBadge}>
                Contém sua alergia
              </div>
            ) : estoqueBaixo ?(
              <div style={s.lowStockBadge}>
                Poucas un!
              </div>
            ) : null}
          </div>
        )}
        <div style={{ ...s.precoBadge, fontSize: isMobile ?'0.82rem' : '0.95rem', padding: isMobile ?'0.2rem 0.5rem' : '0.25rem 0.65rem' }}>
          R$ {produto.preco.toFixed(2).replace('.', ',')}
        </div>
        <button
          style={{ ...s.favBtn, background: isFav ?'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.85)', width: isMobile ?28 : 32, height: isMobile ?28 : 32, fontSize: isMobile ?'0.85rem' : '1rem' }}
          onClick={e => { e.stopPropagation(); onFav(produto.id) }}
        >{isFav ?'♥' : '♡'}</button>
        {!temAlergia && !estoqueBaixo && !destaque && !isMobile && <div style={s.catPill}>{produto.categoria}</div>}
        {!produto.disponivel && <div style={s.tagIndispBadge}>Indisponível</div>}
      </div>
      <div style={{ ...s.cardBody, padding: isMobile ?'0.6rem 0.7rem 0.7rem' : '0.9rem 1rem 1rem' }}>
        <h3 style={{ ...s.nomeProduto, fontSize: isMobile ?'0.88rem' : '0.97rem', marginBottom: 2 }}>{produto.nome}</h3>
        {avaliacao?.total > 0 && (
          <div style={s.ratingLinha}>⭐ {avaliacao.media.toFixed(1).replace('.', ',')} <span>({avaliacao.total})</span></div>
        )}
        {destaque && <div style={s.promoTexto}>{destaque}</div>}
        {produto.descricao && (
          <p style={{ ...s.descricao, WebkitLineClamp: isMobile ?1 : 2, marginBottom: 3 }}>{produto.descricao}</p>
        )}
        {(produto.nutricional?.calorias || produto.nutricional?.proteinas || produto.nutricional?.carboidratos) && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
            {produto.nutricional?.calorias && (
              <span style={s.nutriBadge}><Flame size={9} color="#C2410C" strokeWidth={2} style={{ flexShrink: 0 }} /> {produto.nutricional.calorias}kcal</span>
            )}
            {produto.nutricional?.proteinas && (
              <span style={s.nutriBadge}>Prot {produto.nutricional.proteinas}g</span>
            )}
            {produto.nutricional?.carboidratos && (
              <span style={s.nutriBadge}>Carb {produto.nutricional.carboidratos}g</span>
            )}
            {produto.nutricional?.gorduras && !isMobile && (
              <span style={s.nutriBadge}>Gord {produto.nutricional.gorduras}g</span>
            )}
            {produto.nutricional?.sodio && !isMobile && (
              <span style={s.nutriBadge}>Sódio {produto.nutricional.sodio}mg</span>
            )}
          </div>
        )}
        {prodAllergens.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 5 }}>
            {prodAllergens.map(a => {
              const isUserAllergen = userAllergens.includes(a)
              return (
                <span key={a} style={{
                  ...s.allergyBodyPill,
                  background: isUserAllergen ?'#FEE2E2' : '#F1F5F9',
                  color: isUserAllergen ?'#DC2626' : '#64748B',
                  border: isUserAllergen ?'1px solid #FCA5A5' : '1px solid #E2E8F0',
                  fontWeight: isUserAllergen ?800 : 600,
                }}>
                  {isUserAllergen ?'⚠️ ' : ''}{a}
                </span>
              )
            })}
          </div>
        )}
        {produto.estoque > 0 && (
          estoqueBaixo
            ?<span style={{ ...s.estoqueBaixoBadge, fontSize: isMobile ?'0.6rem' : '0.65rem' }}>⚡ Últimas {produto.estoque} unidades!</span>
            : <span style={{ ...s.estoqueNormalBadge, fontSize: isMobile ?'0.6rem' : '0.65rem' }}>{produto.estoque} disponíveis</span>
        )}
        <button
          style={{ ...s.addBtn, ...(isAdded ?s.addBtnOk : {}), ...(disabled ?s.addBtnDis : {}), fontSize: isMobile ?'0.8rem' : '0.88rem', padding: isMobile ?'0.5rem' : '0.6rem', marginTop: 'auto' }}
          onClick={e => { e.stopPropagation(); onAdd(produto) }}
          disabled={disabled}
        >
          {produto.estoque <= 0 ?'Sem estoque' : isAdded ?'✓ Adicionado!' : produto.disponivel ?'+ Adicionar' : 'Indisponível'}
        </button>
      </div>
    </div>
  )
}

export default function Cardapio() {
  const { produtos, pedidos, avisos, adicionarAoCarrinho, favoritos, toggleFavorito, usuarioLogado, carrinho, resumoAvaliacoesPorProduto } = useApp()
  const isMobile = useIsMobile()
  const [categoriaAtiva, setCategoriaAtiva] = useState('Todos')
  const [busca, setBusca] = useState('')
  const [adicionado, setAdicionado] = useState(null)
  const [alertaProduto, setAlertaProduto] = useState(null)
  const [detalhe, setDetalhe] = useState(null)

  const disponiveisOrdenados = useMemo(
    () => produtos.filter(p => p.disponivel && p.estoque > 0 && produtoDisponivelNoDia(p)),
    [produtos]
  )

  const confirmarAdicionar = useCallback((produto) => {
    adicionarAoCarrinho(produto)
    setAdicionado(produto.id)
    setTimeout(() => setAdicionado(null), 1200)
    setAlertaProduto(null)
  }, [adicionarAoCarrinho])

  const handleAdicionar = useCallback((produto) => {
    const itemNoCarrinho = carrinho.find(i => i.id === produto.id)
    if (!produto.disponivel || produto.estoque <= 0) return
    if (itemNoCarrinho?.quantidade >= produto.estoque) {
      alert('Quantidade máxima em estoque atingida.')
      return
    }
    const alergiasUsr = usuarioLogado?.alergias || []
    const comuns = (produto.alergenios || []).filter(a => alergiasUsr.includes(a))
    if (comuns.length > 0) {
      setAlertaProduto({ produto, comuns })
      return
    }
    confirmarAdicionar(produto)
  }, [carrinho, confirmarAdicionar, usuarioLogado])

  const estaIndisponivel = useCallback((produto) => {
    const itemNoCarrinho = carrinho.find(i => i.id === produto.id)
    return !produto.disponivel || produto.estoque <= 0 || itemNoCarrinho?.quantidade >= produto.estoque
  }, [carrinho])

  const pedidosPorAluno = useMemo(() => pedidos.filter(p => p.matricula === usuarioLogado?.matricula), [pedidos, usuarioLogado])

  const jaCompradosIds = useMemo(
    () => [...new Set(pedidosPorAluno.flatMap(p => p.itens?.map(i => i.produtoId) || []))],
    [pedidosPorAluno]
  )

  const maisVendidos = useMemo(() => {
    const contagem = {}
    pedidos.forEach(p => p.itens?.forEach(i => {
      contagem[i.produtoId] = (contagem[i.produtoId] || 0) + i.quantidade
    }))
    return Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id, qtd]) => {
        const produto = disponiveisOrdenados.find(p => p.id === Number(id))
        return produto ?{ ...produto, qtd } : null
      })
      .filter(Boolean)
  }, [pedidos, disponiveisOrdenados])

  const comprarNovamente = useMemo(
    () => jaCompradosIds
      .map(id => disponiveisOrdenados.find(p => p.id === id))
      .filter(Boolean)
      .slice(0, 6),
    [jaCompradosIds, disponiveisOrdenados]
  )

  const produtosPromocao = useMemo(() => {
    const promoMap = new Map()
    avisos
      .filter(aviso => {
        const destino = aviso.destino || aviso.destinatario || 'todos'
        return aviso.tipo === 'promo' && aviso.produtoPromocao?.id && ['todos', 'aluno', 'alunos'].includes(destino)
      })
      .forEach(aviso => {
        const produto = disponiveisOrdenados.find(p => String(p.id) === String(aviso.produtoPromocao.id))
        if (produto && !promoMap.has(String(produto.id))) {
          promoMap.set(String(produto.id), {
            ...produto,
            promoTitulo: aviso.titulo,
            promoMensagem: aviso.mensagem || aviso.texto || 'Produto em promocao',
          })
        }
      })
    return Array.from(promoMap.values()).slice(0, 6)
  }, [avisos, disponiveisOrdenados])

  const filtrados = useMemo(() => disponiveisOrdenados.filter(p => {
    const matchCat = categoriaAtiva === 'Todos' || p.categoria === categoriaAtiva
    const matchBusca = p.nome.toLowerCase().includes(busca.toLowerCase())
    return matchCat && matchBusca
  }), [disponiveisOrdenados, categoriaAtiva, busca])

  const cols = useMemo(() => isMobile ?'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(230px, 1fr))', [isMobile])

  const mobileGap = isMobile ?'0.55rem' : '1.1rem'
  const mobileSectionMb = isMobile ?'0.65rem' : '1.5rem'

  return (
    <Layout titulo="Cardápio de Hoje">
      <AvisosBanner perfil="alunos" />
      {!busca && (
        <div style={{ marginBottom: isMobile ?'0.65rem' : '1rem' }}>
          <LanchoneteInfoCard compacto isMobile={isMobile} />
        </div>
      )}
      <div style={{ marginBottom: isMobile ?'0.5rem' : '1rem' }}>
        <input
          style={{ ...s.inputBusca, width: '100%', maxWidth: '100%', boxSizing: 'border-box', padding: isMobile ?'0.6rem 0.9rem' : '0.75rem 1.1rem', fontSize: isMobile ?'0.88rem' : '0.95rem' }}
          placeholder="Buscar produto..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
        />
      </div>

      {/* Seção: Comprar Novamente */}
      {!busca && comprarNovamente.length > 0 && (
        <section style={{ marginBottom: mobileSectionMb }}>
          <h2 style={{ ...s.secaoTitulo, fontSize: isMobile ?'0.9rem' : '1.05rem', marginBottom: isMobile ?'0.45rem' : '0.75rem' }}><RefreshCw size={14} strokeWidth={2.5} style={{ marginRight: 5 }} />Comprar Novamente</h2>
          <div style={{ ...s.grid, gridTemplateColumns: cols, gap: mobileGap }}>
            {comprarNovamente.map(p => (
              <ProdutoCard key={p.id} produto={p} onAdd={handleAdicionar}
                isFav={favoritos.includes(p.id)} onFav={toggleFavorito}
                adicionado={adicionado} isMobile={isMobile} disabled={estaIndisponivel(p)}
                alergiasUsuario={usuarioLogado?.alergias || []}
                avaliacao={resumoAvaliacoesPorProduto?.[String(p.id)]}
                onClick={() => setDetalhe(p)} />
            ))}
          </div>
        </section>
      )}

      {/* Seção: Mais Vendidos */}
      {!busca && maisVendidos.length > 0 && (
        <section style={{ marginBottom: mobileSectionMb }}>
          <h2 style={{ ...s.secaoTitulo, fontSize: isMobile ?'0.9rem' : '1.05rem', marginBottom: isMobile ?'0.45rem' : '0.75rem' }}><Trophy size={14} strokeWidth={2.5} style={{ marginRight: 5 }} />Mais Vendidos</h2>
          <div style={{ ...s.grid, gridTemplateColumns: cols, gap: mobileGap }}>
            {maisVendidos.map(p => (
              <ProdutoCard key={p.id} produto={p} onAdd={handleAdicionar}
                isFav={favoritos.includes(p.id)} onFav={toggleFavorito}
                adicionado={adicionado} isMobile={isMobile} disabled={estaIndisponivel(p)}
                alergiasUsuario={usuarioLogado?.alergias || []}
                avaliacao={resumoAvaliacoesPorProduto?.[String(p.id)]}
                onClick={() => setDetalhe(p)} />
            ))}
          </div>
        </section>
      )}

      {!busca && produtosPromocao.length > 0 && (
        <section style={{ marginBottom: mobileSectionMb }}>
          <h2 style={{ ...s.secaoTitulo, fontSize: isMobile ?'0.9rem' : '1.05rem', marginBottom: isMobile ?'0.45rem' : '0.75rem' }}><Tags size={14} strokeWidth={2.5} style={{ marginRight: 5 }} />Em promoção</h2>
          <div style={{ ...s.grid, gridTemplateColumns: cols, gap: mobileGap }}>
            {produtosPromocao.map(p => (
              <ProdutoCard key={p.id} produto={p} onAdd={handleAdicionar}
                isFav={favoritos.includes(p.id)} onFav={toggleFavorito}
                adicionado={adicionado} isMobile={isMobile} disabled={estaIndisponivel(p)}
                alergiasUsuario={usuarioLogado?.alergias || []}
                destaque={p.promoMensagem || p.promoTitulo}
                avaliacao={resumoAvaliacoesPorProduto?.[String(p.id)]}
                onClick={() => setDetalhe(p)} />
            ))}
          </div>
        </section>
      )}

      {/* Filtros de categoria */}
      <div style={{ ...s.categorias, gap: isMobile ?5 : 8, marginBottom: isMobile ?'0.5rem' : '1.25rem' }}>
        {categorias.map(cat => (
          <button key={cat}
            style={{ ...s.catBtn, ...(categoriaAtiva === cat ?s.catBtnAtivo : {}), padding: isMobile ?'0.3rem 0.75rem' : '0.45rem 1.2rem', fontSize: isMobile ?'0.78rem' : '0.85rem' }}
            onClick={() => setCategoriaAtiva(cat)}>{cat}</button>
        ))}
      </div>

      {/* Grade principal */}
      <div style={{ ...s.grid, gridTemplateColumns: cols, gap: mobileGap }}>
        {filtrados.map(p => (
          <ProdutoCard key={p.id} produto={p} onAdd={handleAdicionar}
            isFav={favoritos.includes(p.id)} onFav={toggleFavorito}
            adicionado={adicionado} isMobile={isMobile} disabled={estaIndisponivel(p)}
            alergiasUsuario={usuarioLogado?.alergias || []}
            avaliacao={resumoAvaliacoesPorProduto?.[String(p.id)]}
            onClick={() => setDetalhe(p)} />
        ))}
      </div>

      {filtrados.length === 0 && (
        <div style={s.vazio}>
          <Search size={44} strokeWidth={1.2} color="#CBD5E1" />
          <p style={{ marginTop: 8 }}>Nenhum produto encontrado.</p>
        </div>
      )}

      {/* Modal de detalhe do produto */}
      {detalhe && (
        <div style={s.alertaOverlay} onClick={() => setDetalhe(null)}>
          <div style={s.detalheModal} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{
              position: 'relative',
              height: isMobile ?200 : 250,
              background: detalhe.foto ?'transparent' : GRADIENTS[detalhe.id % GRADIENTS.length],
              flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {detalhe.foto
                ?<img src={detalhe.foto} alt={detalhe.nome} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: isMobile ?'5rem' : '7rem', lineHeight: 1 }}>{detalhe.emoji}</span>
              }
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 50%)' }} />

              {/* Fechar */}
              <button onClick={() => setDetalhe(null)} style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,0,0,0.45)', color: '#fff', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.05rem', backdropFilter: 'blur(4px)', zIndex: 2 }}>✕</button>

              {/* Fav */}
              <button onClick={e => { e.stopPropagation(); toggleFavorito(detalhe.id) }} style={{ position: 'absolute', top: 12, right: 12, background: favoritos.includes(detalhe.id) ?'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.85)', color: favoritos.includes(detalhe.id) ?'#fff' : '#64748B', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', backdropFilter: 'blur(4px)', zIndex: 2 }}>
                {favoritos.includes(detalhe.id) ?'♥' : '♡'}
              </button>

              {/* Nome + categoria */}
              <div style={{ position: 'absolute', bottom: 14, left: 16, right: 16, zIndex: 2 }}>
                <div style={{ fontWeight: 800, fontSize: isMobile ?'1.2rem' : '1.45rem', color: '#fff', lineHeight: 1.2 }}>{detalhe.nome}</div>
                <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', marginTop: 3 }}>{detalhe.categoria}</div>
              </div>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', padding: isMobile ?'1rem 1.1rem' : '1.25rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.85rem', flex: 1 }}>

              {/* Preço + status badges */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.65rem', fontWeight: 800, color: '#003D7C' }}>R$ {detalhe.preco.toFixed(2).replace('.', ',')}</span>
                {detalhe.estoque > 0 && detalhe.estoqueBaixo > 0 && detalhe.estoque <= detalhe.estoqueBaixo ?(
                  <span style={s.detBadgeAlerta}>⚡ Últimas {detalhe.estoque} unidades!</span>
                ) : detalhe.estoque > 0 ?(
                  <span style={s.detBadgeOk}>✓ {detalhe.estoque} disponíveis</span>
                ) : (
                  <span style={s.detBadgeSem}>Sem estoque</span>
                )}
                {!detalhe.disponivel && (
                  <span style={s.detBadgeSem}>Indisponível</span>
                )}
                {(detalhe.alergenios || []).some(a => (usuarioLogado?.alergias || []).includes(a)) && (
                  <span style={s.detBadgeAlergia}>⚠️ Contém sua alergia</span>
                )}
              </div>

              {/* Descrição */}
              {detalhe.descricao && (
                <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.65, margin: 0 }}>{detalhe.descricao}</p>
              )}

              {/* Nutricional */}
              {detalhe.nutricional && Object.values(detalhe.nutricional).some(v => v && v !== '') && (
                <div>
                  <div style={s.detSecaoTitulo}>🥗 Informações Nutricionais</div>
                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    {[['calorias','Kcal'],['proteinas','Prot'],['carboidratos','Carb'],['gorduras','Gord'],['sodio','Sódio']].map(([key, label]) =>
                      detalhe.nutricional[key] ?(
                        <div key={key} style={s.nutriCard}>
                          <div style={{ fontWeight: 800, color: '#C2410C', fontSize: '1rem' }}>{detalhe.nutricional[key]}</div>
                          <div style={{ fontSize: '0.62rem', color: '#94A3B8', fontWeight: 600, marginTop: 2 }}>{label}</div>
                        </div>
                      ) : null
                    )}
                  </div>
                </div>
              )}

              {/* Alérgenos */}
              {(detalhe.alergenios || []).length > 0 && (
                <div>
                  <div style={s.detSecaoTitulo}>⚠️ Alérgenos</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {detalhe.alergenios.map(a => {
                      const userHas = (usuarioLogado?.alergias || []).includes(a)
                      return (
                        <span key={a} style={{
                          background: userHas ?'#FEE2E2' : '#F1F5F9',
                          color: userHas ?'#DC2626' : '#64748B',
                          padding: '0.3rem 0.85rem', borderRadius: 20,
                          fontWeight: userHas ?800 : 600, fontSize: '0.83rem',
                          textTransform: 'capitalize',
                          border: `1.5px solid ${userHas ?'#FCA5A5' : '#E2E8F0'}`,
                        }}>
                          {userHas ?'⚠️ ' : ''}{a}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {resumoAvaliacoesPorProduto?.[String(detalhe.id)]?.total > 0 && (
                <div>
                  <div style={s.detSecaoTitulo}>Avaliações dos alunos</div>
                  <div style={s.reviewResumo}>
                    ⭐ {resumoAvaliacoesPorProduto[String(detalhe.id)].media.toFixed(1).replace('.', ',')} de 5
                    <span>{resumoAvaliacoesPorProduto[String(detalhe.id)].total} avaliação(ões)</span>
                  </div>
                  <div style={s.reviewLista}>
                    {resumoAvaliacoesPorProduto[String(detalhe.id)].comentarios.length === 0 ?(
                      <p style={{ margin: 0, color: '#94A3B8', fontSize: '0.82rem' }}>Ainda não há comentários escritos.</p>
                    ) : resumoAvaliacoesPorProduto[String(detalhe.id)].comentarios.map(avaliacao => (
                      <div key={avaliacao.id} style={s.reviewCard}>
                        <strong>{'⭐'.repeat(avaliacao.nota)} <span>{avaliacao.alunoNome || 'Aluno'}</span></strong>
                        <p>{avaliacao.comentario}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botão adicionar */}
              <button
                style={{
                  width: '100%', padding: '0.95rem', borderRadius: 14,
                  background: estaIndisponivel(detalhe) ?'#CBD5E1' : '#F47920',
                  color: estaIndisponivel(detalhe) ?'#94A3B8' : '#fff',
                  fontWeight: 800, border: 'none',
                  cursor: estaIndisponivel(detalhe) ?'not-allowed' : 'pointer',
                  fontSize: '1rem', marginTop: 4,
                  boxShadow: estaIndisponivel(detalhe) ?'none' : '0 4px 14px rgba(244,121,32,0.4)',
                }}
                disabled={estaIndisponivel(detalhe)}
                onClick={() => {
                  setDetalhe(null)
                  handleAdicionar(detalhe)
                }}
              >
                {detalhe.estoque <= 0 ?'Sem estoque' : !detalhe.disponivel ?'Indisponível' : '+ Adicionar ao carrinho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de alergia */}
      {alertaProduto && (
        <div style={s.alertaOverlay}>
          <div style={s.alertaBox}>
            <div style={{ fontSize: '2.5rem', textAlign: 'center', lineHeight: 1 }}>⚠️</div>
            <h3 style={{ fontWeight: 800, color: '#DC2626', textAlign: 'center', margin: '0.6rem 0 0.3rem', fontSize: '1.05rem' }}>Atenção!</h3>
            <p style={{ color: '#374151', textAlign: 'center', fontSize: '0.88rem', margin: '0 0 0.75rem', lineHeight: 1.5 }}>
              Este produto contém ingredientes que você marcou como alergias:
            </p>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1.1rem' }}>
              {alertaProduto.comuns.map(a => (
                <span key={a} style={{ background: '#FEE2E2', color: '#DC2626', padding: '0.3rem 0.85rem', borderRadius: 20, fontWeight: 700, fontSize: '0.85rem', textTransform: 'capitalize' }}>{a}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setAlertaProduto(null)} style={{ flex: 1, padding: '0.75rem', borderRadius: 10, background: '#F1F5F9', color: '#374151', fontWeight: 600, border: 'none', cursor: 'pointer', fontSize: '0.88rem' }}>
                Cancelar
              </button>
              <button onClick={() => confirmarAdicionar(alertaProduto.produto)} style={{ flex: 1, padding: '0.75rem', borderRadius: 10, background: '#F47920', color: '#fff', fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: '0.88rem' }}>
                Adicionar mesmo assim
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

const s = {
  busca: { marginBottom: '1rem' },
  registerRow: { display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' },
  registerBtn: { padding: '0.5rem 0.95rem', borderRadius: 999, background: '#F47920', color: '#fff', fontWeight: 800, border: 'none', cursor: 'pointer' },
  inputBusca: { width: '100%', maxWidth: 420, padding: '0.75rem 1.1rem', borderRadius: 12, border: '2px solid #E2E8F0', fontSize: '0.95rem', outline: 'none', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  secao: { marginBottom: '1.5rem' },
  secaoTitulo: { fontWeight: 800, fontSize: '1.05rem', color: '#1A202C', marginBottom: '0.75rem', display: 'flex', alignItems: 'center' },
  categorias: { display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' },
  catBtn: { padding: '0.45rem 1.2rem', borderRadius: 24, border: '2px solid #E2E8F0', background: '#fff', color: '#64748B', fontWeight: 600, fontSize: '0.85rem' },
  catBtnAtivo: { background: '#003D7C', color: '#fff', border: '2px solid #003D7C' },
  grid: { display: 'grid', gap: '1.1rem', marginBottom: '1rem' },
  card: { background: '#fff', borderRadius: 18, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s, box-shadow 0.2s' },
  imgBox: { position: 'relative', height: 170, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  imgFoto: { width: '100%', height: '100%', objectFit: 'cover' },
  imgOverlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.45) 0%,transparent 55%)' },
  allergyBodyPill: { padding: '2px 7px', borderRadius: 10, fontSize: '0.63rem', textTransform: 'capitalize' },
  nutriBadge: { display: 'inline-flex', alignItems: 'center', gap: 3, background: '#FFF7ED', color: '#C2410C', padding: '0.12rem 0.4rem', borderRadius: 8, fontSize: '0.63rem', fontWeight: 700 },
  alertaOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '1rem' },
  alertaBox: { background: '#fff', borderRadius: 18, padding: '1.75rem 1.5rem', width: '100%', maxWidth: 360, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  detalheModal: { background: '#fff', borderRadius: 20, width: '100%', maxWidth: 460, maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' },
  detSecaoTitulo: { fontWeight: 700, fontSize: '0.82rem', color: '#374151', marginBottom: 8 },
  nutriCard: { background: '#FFF7ED', borderRadius: 12, padding: '0.6rem 0.8rem', textAlign: 'center', minWidth: 52 },
  detBadgeAlerta: { background: '#FEF3C7', color: '#B45309', padding: '0.25rem 0.75rem', borderRadius: 20, fontWeight: 800, fontSize: '0.8rem' },
  detBadgeOk: { background: '#D1FAE5', color: '#059669', padding: '0.25rem 0.75rem', borderRadius: 20, fontWeight: 700, fontSize: '0.8rem' },
  detBadgeSem: { background: '#FEE2E2', color: '#DC2626', padding: '0.25rem 0.75rem', borderRadius: 20, fontWeight: 700, fontSize: '0.8rem' },
  detBadgeAlergia: { background: '#FEE2E2', color: '#DC2626', padding: '0.25rem 0.75rem', borderRadius: 20, fontWeight: 700, fontSize: '0.8rem' },
  reviewResumo: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 12, padding: '0.55rem 0.75rem', fontSize: '0.85rem', fontWeight: 900 },
  reviewLista: { display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 },
  reviewCard: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 12, padding: '0.65rem 0.75rem' },
  reviewCardP: { margin: '0.35rem 0 0', color: '#475569', fontSize: '0.82rem', lineHeight: 1.45 },
  emoji: { fontSize: '4rem', lineHeight: 1, userSelect: 'none' },
  precoBadge: { position: 'absolute', bottom: 10, left: 10, background: 'rgba(0,0,0,0.65)', color: '#fff', padding: '0.25rem 0.65rem', borderRadius: 20, fontWeight: 800, fontSize: '0.95rem', backdropFilter: 'blur(4px)' },
  topBadges: { position: 'absolute', top: 8, left: 10, right: 44, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 5, zIndex: 4, pointerEvents: 'none' },
  promoBadge: { background: '#FEF3C7', color: '#92400E', borderRadius: 8, padding: '0.16rem 0.45rem', fontSize: '0.62rem', fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 3, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  alertBadge: { background: '#FEE2E2', color: '#DC2626', borderRadius: 8, padding: '0.12rem 0.45rem', fontSize: '0.62rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 3, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  lowStockBadge: { background: 'rgba(245,158,11,0.92)', color: '#fff', borderRadius: 8, padding: '0.12rem 0.45rem', fontSize: '0.62rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  promoTexto: { background: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.28rem 0.45rem', fontSize: '0.7rem', fontWeight: 800, lineHeight: 1.25 },
  favBtn: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 900, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.18)' },
  catPill: { position: 'absolute', top: 8, left: 10, background: 'rgba(255,255,255,0.88)', color: '#334155', padding: '0.18rem 0.65rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700 },
  tagIndispBadge: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', color: '#fff', fontWeight: 800, fontSize: '0.95rem' },
  cardBody: { padding: '0.9rem 1rem 1rem', display: 'flex', flexDirection: 'column', flex: 1, gap: 4 },
  nomeProduto: { fontWeight: 800, fontSize: '0.97rem', color: '#1A202C', marginBottom: 2 },
  ratingLinha: { color: '#92400E', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '0.18rem 0.45rem', fontSize: '0.7rem', fontWeight: 900, display: 'inline-flex', gap: 4, alignItems: 'center', alignSelf: 'flex-start' },
  descricao: { fontSize: '0.78rem', color: '#64748B', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  addBtn: { width: '100%', padding: '0.6rem', borderRadius: 10, background: '#F47920', color: '#fff', fontWeight: 700, fontSize: '0.88rem', transition: 'background 0.2s', marginTop: 8, border: 'none', cursor: 'pointer' },
  addBtnOk: { background: '#22C55E' },
  addBtnDis: { background: '#CBD5E1', color: '#94A3B8', cursor: 'not-allowed' },
  vazio: { textAlign: 'center', padding: '3rem', color: '#94A3B8', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  estoqueBaixoBadge: { background: '#FEF3C7', color: '#B45309', padding: '0.15rem 0.55rem', borderRadius: 8, fontWeight: 800, display: 'inline-block' },
  estoqueNormalBadge: { background: '#F1F5F9', color: '#64748B', padding: '0.15rem 0.55rem', borderRadius: 8, fontWeight: 600, display: 'inline-block' },
}
