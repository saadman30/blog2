import { describe, expect, it } from 'vitest';
import { cn } from '@/utils/cn';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });
});
