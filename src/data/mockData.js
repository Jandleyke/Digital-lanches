export const produtos = [
  { id: 1, nome: 'X-Burguer', categoria: 'Lanches', preco: 12.90, descricao: 'Pão, hambúrguer artesanal, queijo, alface e tomate', disponivel: true, estoque: 20, emoji: '🍔', favoritos: 87 },
  { id: 2, nome: 'X-Frango', categoria: 'Lanches', preco: 11.90, descricao: 'Pão, frango grelhado, queijo, alface e molho especial', disponivel: true, estoque: 15, emoji: '🥪', favoritos: 64 },
  { id: 3, nome: 'Pastel de Carne', categoria: 'Salgados', preco: 6.50, descricao: 'Pastel frito crocante com carne moída temperada', disponivel: true, estoque: 30, emoji: '🥟', favoritos: 112 },
  { id: 4, nome: 'Pastel de Queijo', categoria: 'Salgados', preco: 6.00, descricao: 'Pastel frito crocante com queijo derretido', disponivel: true, estoque: 25, emoji: '🥟', favoritos: 98 },
  { id: 5, nome: 'Coxinha', categoria: 'Salgados', preco: 5.00, descricao: 'Coxinha de frango com catupiry', disponivel: true, estoque: 40, emoji: '🍗', favoritos: 145 },
  { id: 6, nome: 'Pão de Queijo', categoria: 'Salgados', preco: 3.50, descricao: 'Pão de queijo assado, quentinho', disponivel: true, estoque: 50, emoji: '🧀', favoritos: 203 },
  { id: 13, nome: 'Salada Verde', categoria: 'Lanches', preco: 9.50, descricao: 'Mix de folhas, tomate e molho leve', disponivel: true, estoque: 25, emoji: '🥗', favoritos: 45, alergenios: [] },
  { id: 7, nome: 'Suco de Laranja', categoria: 'Bebidas', preco: 7.00, descricao: 'Suco natural de laranja 300ml', disponivel: true, estoque: 20, emoji: '🍊', favoritos: 76 },
  { id: 8, nome: 'Suco de Maracujá', categoria: 'Bebidas', preco: 7.00, descricao: 'Suco natural de maracujá 300ml', disponivel: true, estoque: 18, emoji: '🍹', favoritos: 54 },
  { id: 14, nome: 'Bolo de Chocolate (com trigo)', categoria: 'Doces', preco: 5.50, descricao: 'Fatia de bolo de chocolate com cobertura', disponivel: true, estoque: 12, emoji: '🎂', favoritos: 92, alergenios: ['gluten', 'lactose', 'ovo'] },
  { id: 9, nome: 'Refrigerante Lata', categoria: 'Bebidas', preco: 5.00, descricao: 'Coca-Cola, Guaraná ou Sprite 350ml', disponivel: true, estoque: 60, emoji: '🥤', favoritos: 88 },
  { id: 10, nome: 'Água Mineral', categoria: 'Bebidas', preco: 3.00, descricao: 'Água mineral 500ml', disponivel: true, estoque: 80, emoji: '💧', favoritos: 31 },
  { id: 11, nome: 'Misto Quente', categoria: 'Lanches', preco: 8.00, descricao: 'Pão de forma, presunto e queijo grelhado', disponivel: false, estoque: 0, emoji: '🥪', favoritos: 59 },
  { id: 12, nome: 'Bolo de Chocolate', categoria: 'Doces', preco: 5.50, descricao: 'Fatia de bolo de chocolate com cobertura', disponivel: true, estoque: 12, emoji: '🎂', favoritos: 92 },
];

export const categorias = ['Todos', 'Lanches', 'Salgados', 'Bebidas', 'Doces'];

export const pedidosIniciais = [];

export const usuarios = [
  { id: 1, nome: 'Ana Silva', matricula: '2024001', senha: '1234', perfil: 'aluno', curso: 'Desenvolvimento de Sistemas' },
  { id: 2, nome: 'Carlos Mendes', matricula: '2024002', senha: '1234', perfil: 'aluno', curso: 'Administração' },
  { id: 3, nome: 'Maria Santos', matricula: '2024003', senha: '1234', perfil: 'aluno', curso: 'Enfermagem' },
  { id: 4, nome: 'Cozinha Senac',  matricula: 'COZ001', senha: 'coz123', perfil: 'cozinha',  curso: '', telefone: '(11) 91111-2222', email: '' },
  { id: 5, nome: 'Admin Senac',   matricula: 'ADM001', senha: 'adm123', perfil: 'admin',    curso: '', telefone: '(11) 93333-4444', email: '' },
  { id: 6, nome: 'Gerente Senac', matricula: 'GER001', senha: 'ger123', perfil: 'gerente',  curso: '', telefone: '(11) 95555-6666', email: '' },
];
