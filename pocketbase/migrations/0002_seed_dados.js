migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // Seed default test user: dgorodrigues@hotmail.com with password Skip@Pass
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'dgorodrigues@hotmail.com')
    } catch (_) {
      const record = new Record(users)
      record.setEmail('dgorodrigues@hotmail.com')
      record.setPassword('Skip@Pass')
      record.setVerified(true)
      record.set('name', 'Danilo Rodrigues')
      app.save(record)
    }
  },
  (app) => {
    try {
      const record = app.findAuthRecordByEmail('_pb_users_auth_', 'dgorodrigues@hotmail.com')
      app.delete(record)
    } catch (_) {}
  },
)
