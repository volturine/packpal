import { unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';

const TEST_DB_PATH = path.join(process.cwd(), 'data', 'packpal-test.db');

/** Remove the test database and its WAL/SHM files before the test suite runs. */
export default function globalSetup() {
	for (const suffix of ['', '-wal', '-shm']) {
		const file = TEST_DB_PATH + suffix;
		if (existsSync(file)) {
			unlinkSync(file);
		}
	}
}
