// Teams: each customer company sees only its own data. `node strut migrate` and `db:seed` read
// this file directly (a plain object, not a defineConfig file), so keep it plain data.
//
// Teams are off. The installer writes `enabled: true` when you answer yes to teams. Isolation is
// the ORM's tenant scope, plus PostgreSQL row-level security as a second lock (ADR-0007) when the
// database is PostgreSQL.
export default {
  enabled: false,
  /** The column that holds each row's team. */
  column: 'tenant_id',
}
