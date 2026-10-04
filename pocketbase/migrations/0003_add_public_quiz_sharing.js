migrate(
  (app) => {
    // 1. Atualizar a coleção quizzes
    const quizzes = app.findCollectionByNameOrId('quizzes')

    if (!quizzes.fields.getByName('token_publico')) {
      quizzes.fields.add(
        new TextField({
          name: 'token_publico',
          required: false,
          min: 0,
          max: 64,
        }),
      )
    }

    if (!quizzes.fields.getByName('publico_ativo')) {
      quizzes.fields.add(
        new BoolField({
          name: 'publico_ativo',
          required: false,
        }),
      )
    }

    // Regra de leitura (list / view): dono do quiz OU quiz público ativo
    quizzes.listRule =
      "(@request.auth.id != '' && usuario_id = @request.auth.id) || publico_ativo = true"
    quizzes.viewRule =
      "(@request.auth.id != '' && usuario_id = @request.auth.id) || publico_ativo = true"

    // Gerar token_publico e ativar compartilhamento para os quizzes já existentes
    app.save(quizzes)

    // Preencher tokens para registros que ainda não tenham
    const existingQuizzes = app.findRecordsByFilter(
      'quizzes',
      "token_publico = '' || token_publico = null",
      '',
      100,
      0,
    )
    for (let i = 0; i < existingQuizzes.length; i++) {
      const q = existingQuizzes[i]
      const token = $security.randomString(32)
      q.set('token_publico', token)
      q.set('publico_ativo', true)
      app.save(q)
    }

    // Adicionar índice para busca rápida por token_publico
    try {
      quizzes.addIndex('idx_quizzes_token_publico', false, 'token_publico', '')
      app.save(quizzes)
    } catch (_) {}

    // 2. Atualizar a coleção perguntas
    const perguntas = app.findCollectionByNameOrId('perguntas')
    // Leitura: dono OU quiz pai com publico_ativo = true
    perguntas.listRule =
      "(@request.auth.id != '' && quiz_id.usuario_id = @request.auth.id) || quiz_id.publico_ativo = true"
    perguntas.viewRule =
      "(@request.auth.id != '' && quiz_id.usuario_id = @request.auth.id) || quiz_id.publico_ativo = true"
    app.save(perguntas)

    // 3. Atualizar a coleção tentativas
    const tentativas = app.findCollectionByNameOrId('tentativas')

    if (!tentativas.fields.getByName('nome_jogador')) {
      tentativas.fields.add(
        new TextField({
          name: 'nome_jogador',
          required: false,
          max: 120,
        }),
      )
    }

    // Tornar usuario_id não obrigatório para permitir jogadores convidados
    const usuarioField = tentativas.fields.getByName('usuario_id')
    if (usuarioField) {
      usuarioField.required = false
    }

    // Regras de tentativas:
    // list/view: dono do quiz (quiz_id.usuario_id = @request.auth.id) OU dono da tentativa
    tentativas.listRule =
      "@request.auth.id != '' && (usuario_id = @request.auth.id || quiz_id.usuario_id = @request.auth.id)"
    tentativas.viewRule =
      "@request.auth.id != '' && (usuario_id = @request.auth.id || quiz_id.usuario_id = @request.auth.id)"

    // createRule: autenticado OU quiz pai com publico_ativo = true
    tentativas.createRule = "(@request.auth.id != '') || (quiz_id.publico_ativo = true)"

    app.save(tentativas)
  },
  (app) => {
    // Rollback
    try {
      const quizzes = app.findCollectionByNameOrId('quizzes')
      quizzes.listRule = "@request.auth.id != '' && usuario_id = @request.auth.id"
      quizzes.viewRule = "@request.auth.id != '' && usuario_id = @request.auth.id"
      quizzes.fields.removeByName('token_publico')
      quizzes.fields.removeByName('publico_ativo')
      app.save(quizzes)
    } catch (_) {}

    try {
      const perguntas = app.findCollectionByNameOrId('perguntas')
      perguntas.listRule = "@request.auth.id != '' && quiz_id.usuario_id = @request.auth.id"
      perguntas.viewRule = "@request.auth.id != '' && quiz_id.usuario_id = @request.auth.id"
      app.save(perguntas)
    } catch (_) {}

    try {
      const tentativas = app.findCollectionByNameOrId('tentativas')
      tentativas.listRule = "@request.auth.id != '' && usuario_id = @request.auth.id"
      tentativas.viewRule = "@request.auth.id != '' && usuario_id = @request.auth.id"
      tentativas.createRule = "@request.auth.id != '' && usuario_id = @request.auth.id"
      tentativas.fields.removeByName('nome_jogador')
      app.save(tentativas)
    } catch (_) {}
  },
)
