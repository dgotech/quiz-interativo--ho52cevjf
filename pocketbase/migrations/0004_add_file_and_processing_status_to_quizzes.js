migrate(
  (app) => {
    const quizzes = app.findCollectionByNameOrId('quizzes')

    // 1. Campo de arquivo nativo PocketBase (armazenamento de arquivos de até 100MB)
    if (!quizzes.fields.getByName('arquivo')) {
      quizzes.fields.add(
        new FileField({
          name: 'arquivo',
          required: false,
          maxSelect: 1,
          maxSize: 104857600, // 100 MB em bytes
          mimeTypes: [
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip',
            'application/octet-stream',
          ],
        }),
      )
    }

    // 2. Status do processamento: 'pendente', 'processando', 'concluido', 'erro'
    if (!quizzes.fields.getByName('status_processamento')) {
      quizzes.fields.add(
        new SelectField({
          name: 'status_processamento',
          required: false,
          values: ['pendente', 'processando', 'concluido', 'erro'],
          maxSelect: 1,
        }),
      )
    }

    // 3. Mensagem de erro caso ocorra durante a extração ou IA
    if (!quizzes.fields.getByName('erro_processamento')) {
      quizzes.fields.add(
        new TextField({
          name: 'erro_processamento',
          required: false,
          max: 2000,
        }),
      )
    }

    // 4. Total de perguntas geradas
    if (!quizzes.fields.getByName('total_perguntas')) {
      quizzes.fields.add(
        new NumberField({
          name: 'total_perguntas',
          required: false,
        }),
      )
    }

    app.save(quizzes)
  },
  (app) => {
    try {
      const quizzes = app.findCollectionByNameOrId('quizzes')
      quizzes.fields.removeByName('arquivo')
      quizzes.fields.removeByName('status_processamento')
      quizzes.fields.removeByName('erro_processamento')
      quizzes.fields.removeByName('total_perguntas')
      app.save(quizzes)
    } catch (_) {}
  },
)
