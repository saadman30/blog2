import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

describe('ui components', () => {
  it('renders button variants', () => {
    render(<Button variant="outline" size="sm">Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toBeInTheDocument();
    render(
      <Button asChild>
        <a href="/blog">Link</a>
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Link' })).toBeInTheDocument();
  });

  it('renders badge, card, and input', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Desc</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge>tag</Badge>
          <Input aria-label="Name" />
        </CardContent>
      </Card>,
    );
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('tag')).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
  });
});
