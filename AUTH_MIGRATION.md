# Autenticacao atual

O app usa Firebase Authentication apenas com e-mail e senha.

Apos o login, o app busca o perfil em:

```txt
usuarios/{uid}
```

Estrutura esperada:

```json
{
  "uid": "uid-do-firebase-auth",
  "nome": "Nome do usuario",
  "email": "usuario@email.com",
  "matricula": "2024001",
  "role": "aluno",
  "ativo": true
}
```

Roles aceitos:

- `aluno`
- `professor`
- `admin`
- `vendedor`
- `cozinha`

Redirecionamento:

- `aluno` -> `/aluno/cardapio`
- `professor` -> `/aluno/cardapio`
- `admin` -> `/admin`
- `vendedor` -> `/vendedor`
- `cozinha` -> `/cozinha`

Observacoes:

- A matricula nao autentica mais. Ela e apenas informacao cadastral.
- O cadastro/exclusao feito pelo admin passa pela API `/api/adminUsuarios`, criando ou removendo o usuario no Firebase Authentication e no Firestore juntos.
- Configure `FIREBASE_SERVICE_ACCOUNT_JSON` ou `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` no ambiente do servidor para essa API funcionar.
- A redefinicao de senha usa `sendPasswordResetEmail`.
- EmailJS permanece apenas para notificacoes, contato, feedback e sugestoes.
- Para usuarios de equipe, consulte `MANUAL_SETUP_USUARIOS.md`.
