# Setup manual de usuarios

O login usa somente Firebase Authentication com e-mail e senha.
A matricula e apenas um campo salvo no Firestore.
Para redefinicao de senha funcionar de verdade, use um e-mail real que a pessoa consiga acessar.

Para cada usuario de equipe:

1. Acesse Firebase Console > Authentication > Usuarios.
2. Clique em "Adicionar usuario".
3. Informe e-mail e senha.
4. Copie o UID criado.
5. Acesse Cloud Firestore > usuarios.
6. Crie um documento com o ID igual ao UID.

Modelo do documento:

```json
{
  "uid": "COLE_O_UID_AQUI",
  "nome": "Admin Senac",
  "email": "adm001@senac-lanches.local",
  "matricula": "ADM001",
  "role": "admin",
  "ativo": true
}
```

Usuarios refeitos no projeto `senac-lanches` em 08/06/2026.
Senha provisoria para os tres acessos: `Senac@123`

```json
{
  "uid": "imQRG0nNXydeHQl6YsWXVE9Wt4A3",
  "nome": "Admin Senac",
  "email": "adm001@senac-lanches.local",
  "matricula": "ADM001",
  "role": "admin",
  "ativo": true
}
```

```json
{
  "uid": "OJTEHh3b27eoT5q9nEuojExyMmk1",
  "nome": "Vendedor Senac",
  "email": "vendedor@senac-lanches.local",
  "matricula": "VEN001",
  "role": "vendedor",
  "ativo": true
}
```

```json
{
  "uid": "gW37GF9FeeMtRoQPs5cFhleudFb2",
  "nome": "Cozinha Senac",
  "email": "cozinha@senac-lanches.local",
  "matricula": "COZ001",
  "role": "cozinha",
  "ativo": true
}
```

Redirecionamento apos login:

- `aluno` vai para `/aluno/cardapio`
- `admin` vai para `/admin`
- `vendedor` vai para `/vendedor`
- `cozinha` vai para `/cozinha`

Redefinicao de senha:

- Use o e-mail da conta.
- O Firebase envia o link por `sendPasswordResetEmail`.
- EmailJS fica somente para notificacoes, contato, feedback e sugestoes.
