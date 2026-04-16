import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

function Greet({ name }: { name: string }) {
  return <p>Hello, {name}</p>;
}

describe('sanity', () => {
  it('renders a component', () => {
    render(<Greet name="world" />);
    expect(screen.getByText('Hello, world')).toBeInTheDocument();
  });
});
