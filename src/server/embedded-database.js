import { PGlite } from '@electric-sql/pglite';

// Match the subset of Neon's lazy query API used by the application. Keeping
// queries lazy is essential: transaction arrays must not execute before BEGIN.
export function embeddedSql(database) {
  const owner = Symbol('embedded query');
  function query(text, values = []) {
    let result;
    return {
      owner, text, values,
      then(resolve, reject) {
        result ||= database.query(text, values).then((result) => result.rows);
        return result.then(resolve, reject);
      },
    };
  }
  const sql = (strings, ...values) => query(
    strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, ''), values,
  );
  sql.query = query;
  sql.transaction = async (queries, options = {}) => {
    if (!Array.isArray(queries) || queries.some((query) => query.owner !== owner)) {
      throw new Error('Transaction requires queries from the same embedded client.');
    }
    return database.transaction(async (tx) => {
      if (options.isolationLevel) {
        const isolation = { RepeatableRead: 'REPEATABLE READ', Serializable: 'SERIALIZABLE', ReadCommitted: 'READ COMMITTED' }[options.isolationLevel];
        if (!isolation) throw new Error('Unsupported transaction isolation level.');
        await tx.exec(`SET TRANSACTION ISOLATION LEVEL ${isolation}`);
      }
      if (options.readOnly) await tx.exec('SET TRANSACTION READ ONLY');
      const results = [];
      for (const { text, values } of queries) results.push((await tx.query(text, values)).rows);
      return results;
    });
  };
  return sql;
}

// Reuse the connection across Astro module reloads; a data directory must have
// only one owner. Initialization is explicit in scripts/dev-embedded.js, not on GET.
export function testDatabase() {
  const key = Symbol.for('ground-truth.test-database');
  globalThis[key] ||= embeddedSql(new PGlite('.test-data/pglite'));
  return globalThis[key];
}
