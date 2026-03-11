import { describe, expect, it } from 'vitest';
import { applyMigrations } from '../../scripts/migrate.js';

describe('applyMigrations', () => {
  it('exports a callable migration entrypoint', () => {
    expect(applyMigrations).toBeTypeOf('function');
  });
});
