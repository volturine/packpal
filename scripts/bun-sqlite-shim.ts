import { DatabaseSync } from 'node:sqlite';

export class Database extends DatabaseSync {
	override prepare(sql: string) {
		const stmt = super.prepare(sql);
		const values = (...params: unknown[]) =>
			stmt.all(...(params as never[])).map((row: Record<string, unknown>) => Object.values(row));
		const get = (...params: unknown[]) => stmt.get(...(params as never[])) ?? null;
		return new Proxy(stmt, {
			get(target, prop) {
				if (prop === 'values') return values;
				if (prop === 'get') return get;
				const value = Reflect.get(target, prop);
				return typeof value === 'function' ? value.bind(target) : value;
			}
		});
	}
}

export default Database;
