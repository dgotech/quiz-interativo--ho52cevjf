migrate(
  (app) => {
    // 1. quizzes collection
    const quizzes = new Collection({
      name: 'quizzes',
      type: 'base',
      listRule: "@request.auth.id != '' && usuario_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && usuario_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && usuario_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && usuario_id = @request.auth.id",
      fields: [
        {
          name: 'tipo_arquivo',
          type: 'select',
          required: true,
          values: ['pptx', 'xlsx'],
          maxSelect: 1,
        },
        { name: 'nome_arquivo', type: 'text', required: true },
        { name: 'nome_quiz', type: 'text', required: true },
        { name: 'conteudo_extraido', type: 'editor' },
        {
          name: 'usuario_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_quizzes_usuario_created ON quizzes (usuario_id, created DESC)'],
    })
    app.save(quizzes)

    const quizzesId = app.findCollectionByNameOrId('quizzes').id

    // 2. perguntas collection
    const perguntas = new Collection({
      name: 'perguntas',
      type: 'base',
      listRule: "@request.auth.id != '' && quiz_id.usuario_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && quiz_id.usuario_id = @request.auth.id",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != '' && quiz_id.usuario_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && quiz_id.usuario_id = @request.auth.id",
      fields: [
        {
          name: 'quiz_id',
          type: 'relation',
          required: true,
          collectionId: quizzesId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'enunciado', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['multipla_escolha', 'aberta'],
          maxSelect: 1,
        },
        { name: 'opcoes', type: 'json' },
        { name: 'resposta_correta', type: 'text' },
        { name: 'explicacao', type: 'text' },
        { name: 'ordem', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_perguntas_quiz_ordem ON perguntas (quiz_id, ordem ASC)'],
    })
    app.save(perguntas)

    // 3. tentativas collection
    const tentativas = new Collection({
      name: 'tentativas',
      type: 'base',
      listRule: "@request.auth.id != '' && usuario_id = @request.auth.id",
      viewRule: "@request.auth.id != '' && usuario_id = @request.auth.id",
      createRule: "@request.auth.id != '' && usuario_id = @request.auth.id",
      updateRule: "@request.auth.id != '' && usuario_id = @request.auth.id",
      deleteRule: "@request.auth.id != '' && usuario_id = @request.auth.id",
      fields: [
        {
          name: 'quiz_id',
          type: 'relation',
          required: true,
          collectionId: quizzesId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'usuario_id',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          cascadeDelete: true,
          maxSelect: 1,
        },
        { name: 'respostas', type: 'json' },
        { name: 'pontuacao', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_tentativas_quiz_usuario ON tentativas (quiz_id, usuario_id, created DESC)',
      ],
    })
    app.save(tentativas)
  },
  (app) => {
    try {
      const tentativas = app.findCollectionByNameOrId('tentativas')
      app.delete(tentativas)
    } catch (_) {}
    try {
      const perguntas = app.findCollectionByNameOrId('perguntas')
      app.delete(perguntas)
    } catch (_) {}
    try {
      const quizzes = app.findCollectionByNameOrId('quizzes')
      app.delete(quizzes)
    } catch (_) {}
  },
)
