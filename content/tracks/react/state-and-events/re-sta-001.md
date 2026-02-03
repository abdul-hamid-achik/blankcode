---
slug: react-state-and-events-counter
title: Building a Simple Counter with useState
description: Learn how to use the useState hook to manage state in a React component and handle user interactions through button clicks.
difficulty: beginner
hints:
  - useState returns an array with two elements - the current state value and a function to update it
  - The function passed to useState is the initial state value
  - Event handlers in React are passed as props using camelCase naming (onClick, onChange, etc.)
  - To update state based on the previous value, you can pass the new value directly to the setter function
tags:
  - react
  - useState
  - state-management
  - events
  - hooks
---

Create a counter component that displays a number and has buttons to increment and decrement it. You'll need to use the `useState` hook to track the counter value and handle click events to update it.

Your task is to:
1. Import the useState hook from React
2. Initialize state with a starting value of 0
3. Connect the increment button to increase the counter
4. Connect the decrement button to decrease the counter

```typescript
import ___blank_start___{ useState }___blank_end___ from 'react';

export default function Counter() {
  const [count, setCount] = ___blank_start___useState(0)___blank_end___;

  const increment = () => {
    ___blank_start___setCount(count + 1)___blank_end___;
  };

  const decrement = () => {
    ___blank_start___setCount(count - 1)___blank_end___;
  };

  return (
    <div>
      <h1>Counter: {count}</h1>
      <button onClick={increment}>Increment</button>
      <button onClick={decrement}>Decrement</button>
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
  it('should render with initial count of 0', () => {
    render(<Counter />);
    expect(screen.getByText(/Counter: 0/i)).toBeInTheDocument();
  });

  it('should increment the counter when increment button is clicked', () => {
    render(<Counter />);
    const incrementButton = screen.getByText(/Increment/i);
    
    fireEvent.click(incrementButton);
    expect(screen.getByText(/Counter: 1/i)).toBeInTheDocument();
    
    fireEvent.click(incrementButton);
    expect(screen.getByText(/Counter: 2/i)).toBeInTheDocument();
  });

  it('should decrement the counter when decrement button is clicked', () => {
    render(<Counter />);
    const decrementButton = screen.getByText(/Decrement/i);
    
    fireEvent.click(decrementButton);
    expect(screen.getByText(/Counter: -1/i)).toBeInTheDocument();
    
    fireEvent.click(decrementButton);
    expect(screen.getByText(/Counter: -2/i)).toBeInTheDocument();
  });

  it('should handle both increment and decrement operations', () => {
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

  it('should have buttons that are clickable', () => {
    render(<Counter />);
    const incrementButton = screen.getByText(/Increment/i);
    const decrementButton = screen.getByText(/Decrement/i);
    
    expect(incrementButton).toBeEnabled();
    expect(decrementButton).toBeEnabled();
  });
});
```