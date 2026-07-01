import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { DataLayerTable, getDataLayerRows, getDataLayerSchema, runDataLayerSql } from '../lib/api';

type DataLayerAdminPanelProps = {
  token: string;
};

export function DataLayerAdminPanel({ token }: DataLayerAdminPanelProps) {
  const [tables, setTables] = useState<DataLayerTable[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [sql, setSql] = useState('select * from products limit 10');
  const [sqlResults, setSqlResults] = useState<Array<{ type: string; rows?: Array<Record<string, unknown>>; status?: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRunningSql, setIsRunningSql] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const activeTable = useMemo(
    () => tables.find((table) => table.name === selectedTable) ?? null,
    [tables, selectedTable],
  );

  async function loadSchema() {
    setIsLoading(true);
    setError('');

    try {
      const response = await getDataLayerSchema(token);
      setTables(response.tables);
      const first = selectedTable || response.tables.find((table) => table.name === 'products')?.name || response.tables[0]?.name || '';
      setSelectedTable(first);

      if (first) {
        await loadRows(first);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load Data Layer.');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRows(table: string) {
    const response = await getDataLayerRows(token, table);
    setRows(response.rows);
    setColumns(response.columns);
    setSelectedTable(table);
  }

  useEffect(() => {
    void loadSchema();
  }, [token]);

  async function handleRunSql(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunningSql(true);
    setError('');
    setMessage('');

    try {
      const response = await runDataLayerSql(token, sql);
      setMessage(response.message);
      setSqlResults(response.results);

      if (selectedTable) {
        await loadRows(selectedTable);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to run SQL.');
    } finally {
      setIsRunningSql(false);
    }
  }

  const relationshipTables = tables.filter((table) => table.relationships.length > 0).slice(0, 10);

  return (
    <article className="panel wide data-layer-panel">
      <div className="panel-heading-row">
        <div>
          <h2>Admin Data Layer</h2>
          <p className="muted">
            View database tables, inspect relationships, and run guarded SQL from the platform console.
          </p>
        </div>
        <button type="button" onClick={loadSchema} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Refresh schema'}
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}
      {message && <div className="form-success">{message}</div>}

      <section className="data-layer-layout">
        <aside className="data-table-list" aria-label="Database tables">
          {tables.map((table) => (
            <button
              key={table.name}
              type="button"
              className={selectedTable === table.name ? 'active' : ''}
              onClick={() => loadRows(table.name)}
            >
              <strong>{table.name}</strong>
              <span>{table.row_count} rows</span>
              <small>{table.editable ? 'Editable' : 'Read only'}</small>
            </button>
          ))}
        </aside>

        <section className="data-layer-main">
          <div className="data-diagram">
            <h3>Relationship diagram</h3>
            <div className="data-diagram-grid">
              {relationshipTables.map((table) => (
                <article key={table.name}>
                  <strong>{table.name}</strong>
                  {table.relationships.slice(0, 4).map((relationship) => (
                    <span key={`${table.name}-${relationship.column}`}>
                      {relationship.column} → {relationship.hint}
                    </span>
                  ))}
                </article>
              ))}
            </div>
          </div>

          <div className="data-table-preview">
            <div className="data-table-heading">
              <div>
                <h3>{selectedTable || 'Select table'}</h3>
                <p className="muted">
                  {activeTable
                    ? `${activeTable.columns.length} columns · ${activeTable.relationships.length} relationship hints`
                    : 'Select a table from the left.'}
                </p>
              </div>
              {activeTable && <span>{activeTable.editable ? 'Editable' : 'Read only'}</span>}
            </div>

            <div className="responsive-table-scroll">
              <table>
                <thead>
                  <tr>
                    {columns.slice(0, 8).map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 12).map((row, index) => (
                    <tr key={`${selectedTable}-${index}`}>
                      {columns.slice(0, 8).map((column) => (
                        <td key={column}>{formatCell(row[column])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <form className="sql-runner" onSubmit={handleRunSql}>
            <label htmlFor="data-layer-sql">
              SQL runner
              <textarea
                id="data-layer-sql"
                value={sql}
                onChange={(event) => setSql(event.target.value)}
                rows={5}
              />
            </label>
            <p className="muted">
              Allowed: SELECT, INSERT, UPDATE, DELETE. Schema-destructive commands are blocked and audited.
            </p>
            <button type="submit" disabled={isRunningSql || !sql.trim()}>
              {isRunningSql ? 'Running...' : 'Run SQL'}
            </button>
          </form>

          {sqlResults.length > 0 && (
            <section className="sql-results">
              <h3>SQL results</h3>
              {sqlResults.map((result, index) => (
                <article key={`sql-result-${index}`}>
                  <strong>{result.type}</strong>
                  {result.rows ? (
                    <pre>{JSON.stringify(result.rows.slice(0, 20), null, 2)}</pre>
                  ) : (
                    <span>{result.status}</span>
                  )}
                </article>
              ))}
            </section>
          )}
        </section>
      </section>
    </article>
  );
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
