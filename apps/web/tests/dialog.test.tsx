import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

describe('dialog', () => {
  it('renders dialog content when open', () => {
    render(
      <Dialog open>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hello</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
