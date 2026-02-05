---
slug: react-performance-and-patterns-memo-basics
title: Optimizing Re-renders with React.memo
description: Learn how to prevent unnecessary re-renders using React.memo to optimize component performance in a simple counter application.
difficulty: beginner
hints:
  - React.memo creates a memoized version of a component that only re-renders when props change
  - Use React.memo by wrapping your component function
  - Components wrapped in React.memo perform a shallow comparison of props
  - Child components re-render by default when parent state changes, even if their props haven't changed
tags:
  - react
  - performance
  - memo
  - optimization
  - patterns
---

In this exercise, you'll optimize a simple application that displays a counter and a list of items. Currently, the `ItemList` component re-renders every time the counter changes, even though its props don't change. Your task is to use `React.memo` to prevent these unnecessary re-renders.

Complete the code by:
1. Importing the memo function from React
2. Wrapping the ItemList component with React.memo
3. Wrapping the ExpensiveDisplay component with React.memo

```typescript
import { ___blank_start___memo___blank_end___, useState } from 'react';

interface ItemListProps {
  items: string[];
}

// Wrap this component to prevent unnecessary re-renders
const ItemList = ___blank_start___memo(___blank_end___({ items }: ItemListProps) => {
  console.log('ItemList rendered');
  return (
    <div>
      <h3>Items:</h3>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}___blank_start___)___blank_end___;

interface ExpensiveDisplayProps {
  value: number;
}

// This component does an expensive calculation
const ExpensiveDisplay = ___blank_start___memo(___blank_end___({ value }: ExpensiveDisplayProps) => {
  console.log('ExpensiveDisplay rendered');
  
  // Simulate expensive calculation
  let result = value;
  for (let i = 0; i < 1000000; i++) {
    result += 0.0001;
  }
  
  return <div>Processed value: {result.toFixed(2)}</div>;
}___blank_start___)___blank_end___;

export default function CounterApp() {
  const [count, setCount] = useState(0);
  const [items] = useState(['Apple', 'Banana', 'Cherry']);
  const [fixedValue] = useState(100);

  return (
    <div>
      <h1>Counter: {count}</h1>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <ItemList items={items} />
      <ExpensiveDisplay value={fixedValue} />
    </div>
  );
}
```

## Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CounterApp from './solution';

describe('React.memo Performance Optimization', () => {
  it('should render the counter app correctly', () => {
    render(<CounterApp />);
    expect(screen.getByText(/Counter: 0/i)).toBeInTheDocument();
    expect(screen.getByText(/Apple/i)).toBeInTheDocument();
    expect(screen.getByText(/Banana/i)).toBeInTheDocument();
    expect(screen.getByText(/Cherry/i)).toBeInTheDocument();
  });

  it('should increment counter when button is clicked', () => {
    render(<CounterApp />);
    const button = screen.getByRole('button', { name: /increment/i });
    
    fireEvent.click(button);
    expect(screen.getByText(/Counter: 1/i)).toBeInTheDocument();
    
    fireEvent.click(button);
    expect(screen.getByText(/Counter: 2/i)).toBeInTheDocument();
  });

  it('should not re-render ItemList when counter changes (memo working)', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    render(<CounterApp />);
    
    // Clear initial render logs
    consoleSpy.mockClear();
    
    const button = screen.getByRole('button', { name: /increment/i });
    fireEvent.click(button);
    
    // ItemList should NOT log on counter update
    const itemListLogs = consoleSpy.mock.calls.filter(
      call => call[0] === 'ItemList rendered'
    );
    expect(itemListLogs.length).toBe(0);
    
    consoleSpy.mockRestore();
  });

  it('should not re-render ExpensiveDisplay when counter changes', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    render(<CounterApp />);
    
    // Clear initial render logs
    consoleSpy.mockClear();
    
    const button = screen.getByRole('button', { name: /increment/i });
    fireEvent.click(button);
    
    // ExpensiveDisplay should NOT log on counter update
    const expensiveDisplayLogs = consoleSpy.mock.calls.filter(
      call => call[0] === 'ExpensiveDisplay rendered'
    );
    expect(expensiveDisplayLogs.length).toBe(0);
    
    consoleSpy.mockRestore();
  });

  it('should display the processed value correctly', () => {
    render(<CounterApp />);
    expect(screen.getByText(/Processed value:/i)).toBeInTheDocument();
  });
});
```