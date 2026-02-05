---
slug: react-state-and-events-counter
title: Interactive Counter with State and Events
description: Build a counter component that uses React state to track a value and event handlers to update it when buttons are clicked.
difficulty: beginner
hints:
  - Use the useState hook to create a state variable for the counter
  - Event handlers in React are passed as props like onClick
  - To update state, call the setter function returned by useState
  - You can pass inline functions or reference named functions in event handlers
tags:
  - react
  - state
  - events
  - hooks
  - useState
---

Create a counter component that displays a number and has buttons to increment and decrement it. You'll need to:

1. Import and use the `useState` hook to manage the counter value
2. Create event handler functions that update the state
3. Attach the event handlers to button click events

```typescript
import React from 'react';
import { ___blank_start___useState___blank_end___ } from 'react';

export default function Counter() {
  const [count, setCount] = ___blank_start___useState(0)___blank_end___;

  const increment = () => {
    setCount(count + 1);
  };

  const decrement = () => {
    setCount(count - 1);
  };

  return (
    <div>
      <h2>Counter: {count}</h2>
      <button ___blank_start___onClick={increment}___blank_end___>
        Increment
      </button>
      <button ___blank_start___onClick={decrement}___blank_end___>
        Decrement
      </button>
    </div>
  );
}
```

## Tests

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Counter from './Counter';

describe('Counter Component', () => {
  it('renders with initial count of 0', () => {
    render(<Counter />);
    expect(screen.getByText(/Counter: 0/i)).toBeInTheDocument();
  });

  it('increments count when Increment button is clicked', () => {
    render(<Counter />);
    const incrementButton = screen.getByText(/Increment/i);
    
    fireEvent.click(incrementButton);
    expect(screen.getByText(/Counter: 1/i)).toBeInTheDocument();
    
    fireEvent.click(incrementButton);
    expect(screen.getByText(/Counter: 2/i)).toBeInTheDocument();
  });

  it('decrements count when Decrement button is clicked', () => {
    render(<Counter />);
    const decrementButton = screen.getByText(/Decrement/i);
    
    fireEvent.click(decrementButton);
    expect(screen.getByText(/Counter: -1/i)).toBeInTheDocument();
    
    fireEvent.click(decrementButton);
    expect(screen.getByText(/Counter: -2/i)).toBeInTheDocument();
  });

  it('handles multiple increment and decrement operations', () => {
    render(<Counter />);
    const incrementButton = screen.getByText(/Increment/i);
    const decrementButton = screen.getByText(/Decrement/i);
    
    fireEvent.click(incrementButton);
    fireEvent.click(incrementButton);
    fireEvent.click(incrementButton);
    expect(screen.getByText(/Counter: 3/i)).toBeInTheDocument();
    
    fireEvent.click(decrementButton);
    expect(screen.getByText(/Counter: 2/i)).toBeInTheDocument();
  });

  it('has properly attached event handlers', () => {
    render(<Counter />);
    const buttons = screen.getAllByRole('button');
    
    expect(buttons).toHaveLength(2);
    expect(buttons[0]).toHaveTextContent('Increment');
    expect(buttons[1]).toHaveTextContent('Decrement');
  });
});
```