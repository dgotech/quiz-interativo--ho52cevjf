migrate(
  (app) => {
    const quizzesId = app.findCollectionByNameOrId('quizzes').id

    // 1. Coleção competicoes
    // status: 'aguardando' | 'em_andamento' | 'encerrada'
    // ativa: bool
    // codigo: código curto único (ex: ZARA-42 ou 6 letras/números maiúsculos)
    const competicoes = new Collection({
      name: 'competicoes',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule:
        "(@request.auth.id != '' && criado_por = @request.auth.id) || (@request.auth.id != '' && quiz.usuario_id = @request.auth.id)",
      deleteRule:
        "(@request.auth.id != '' && criado_por = @request.auth.id) || (@request.auth.id != '' && quiz.usuario_id = @request.auth.id)",
      fields: [
        {
          name: 'quiz',
          type: 'relation',
          required: true,
          collectionId: quizzesId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'codigo',
          type: 'text',
          required: true,
          min: 4,
          max: 16,
        },
        {
          name: 'titulo',
          type: 'text',
          required: false,
          max: 200,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['aguardando', 'em_andamento', 'encerrada'],
          maxSelect: 1,
        },
        {
          name: 'ativa',
          type: 'bool',
          required: false,
        },
        {
          name: 'criado_por',
          type: 'relation',
          required: false,
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_competicoes_codigo ON competicoes (codigo)',
        'CREATE INDEX idx_competicoes_quiz ON competicoes (quiz, created DESC)',
      ],
    })
    app.save(competicoes)

    const competicoesId = app.findCollectionByNameOrId('competicoes').id

    // 2. Coleção grupos
    // Grupos pertencem a uma competição específica
    const grupos = new Collection({
      name: 'grupos',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'competicao',
          type: 'relation',
          required: true,
          collectionId: competicoesId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'nome',
          type: 'text',
          required: true,
          min: 1,
          max: 100,
        },
        {
          name: 'cor',
          type: 'text',
          required: true,
          max: 30,
        },
        {
          name: 'ordem',
          type: 'number',
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_grupos_competicao ON grupos (competicao, ordem ASC)'],
    })
    app.save(grupos)

    const gruposId = app.findCollectionByNameOrId('grupos').id

    // 3. Coleção participacoes
    // Qualquer convidado pode criar sua participação na competição pública
    // Atualizar pode ser público (para enviar pontuação e acertos a cada resposta)
    const participacoes = new Collection({
      name: 'participacoes',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: '',
      updateRule: '',
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'competicao',
          type: 'relation',
          required: true,
          collectionId: competicoesId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'grupo',
          type: 'relation',
          required: true,
          collectionId: gruposId,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'apelido',
          type: 'text',
          required: true,
          min: 1,
          max: 60,
        },
        {
          name: 'pontuacao',
          type: 'number',
          required: false,
        },
        {
          name: 'acertos',
          type: 'number',
          required: false,
        },
        {
          name: 'total_perguntas',
          type: 'number',
          required: false,
        },
        {
          name: 'tempo_segundos',
          type: 'number',
          required: false,
        },
        {
          name: 'finalizada',
          type: 'bool',
          required: false,
        },
        {
          name: 'respostas_detalhe',
          type: 'json',
          required: false,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_participacoes_comp ON participacoes (competicao, pontuacao DESC)',
        'CREATE INDEX idx_participacoes_grupo ON participacoes (grupo)',
      ],
    })
    app.save(participacoes)
  },
  (app) => {
    try {
      const participacoes = app.findCollectionByNameOrId('participacoes')
      app.delete(participacoes)
    } catch (_) {}
    try {
      const grupos = app.findCollectionByNameOrId('grupos')
      app.delete(grupos)
    } catch (_) {}
    try {
      const competicoes = app.findCollectionByNameOrId('competicoes')
      app.delete(competicoes)
    } catch (_) {}
  },
)
