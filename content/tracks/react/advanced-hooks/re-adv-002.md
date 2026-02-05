---
slug: react-advancedhooks-usememo-optimization
title: Optimizing Expensive Calculations with useMemo
description: Learn how to use the useMemo hook to memoize expensive computations and prevent unnecessary recalculations on every render.
difficulty: beginner
hints:
  - useMemo takes two arguments - a function that returns the computed value and a dependency array
  - The memoized value only recalculates when dependencies change
  - Think about what values the calculation depends on
  - useMemo should wrap the expensive calculation, not just return a value
tags:
  - react
  - hooks
  - useMemo
  - performance
  - memoization
---

In this exercise, you'll implement `useMemo` to optimize a component that performs expensive calculations. The component displays a list of numbers and calculates statistics (sum and average) based on those numbers.

Without memoization, these calculations would run on every render, even when the numbers haven't changed. Your task is to use `useMemo` to cache the calculation results.

Complete the blanks to:
1. Import the `useMemo` hook from React
2. Memoize the expensive sum calculation
3. Memoize the average calculation that depends on the sum
4. Specify the correct dependency array so calculations update when numbers change

```typescript
import { useState, ___blank_start___useMemo___blank_end___ } from 'react';

interface NumberStatsProps {
  numbers: number[];
}

// Simulates an expensive calculation
function calculateSum(numbers: number[]): number {
  console.log('Calculating sum...');
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum += numbers[i];
  }
  return sum;
}

export function NumberStats({ numbers }: NumberStatsProps) {
  const [renderCount, setRenderCount] = useState(0);

  // Memoize the expensive sum calculation
  const sum = ___blank_start___useMemo(() => {
    return calculateSum(numbers);
  }, [numbers])___blank_end___;

  // Memoize the average calculation which depends on sum
  const average = ___blank_start___useMemo(() => {
    return numbers.length > 0 ? sum / numbers.length : 0;
  }, [sum, numbers.length])___blank_end___;

  return (
    <div>
      <h2>Number Statistics</h2>
      <p>Count: {numbers.length}</p>
      <p>Sum: {sum}</p>
      <p>Average: {average.toFixed(2)}</p>
      <button onClick={() => setRenderCount(renderCount + 1)}>
        Force Re-render ({renderCount})
      </button>
    </div>
  );
}
```

## Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NumberStats } from './solution';

describe('NumberStats Component', () => {
  it('should render statistics correctly', () => {
    const numbers = [10, 20, 30, 40, 50];
    render(<NumberStats numbers={numbers} />);
    
    expect(screen.getByText('Count: 5')).toBeInTheDocument();
    expect(screen.getByText('Sum: 150')).toBeInTheDocument();
    expect(screen.getByText('Average: 30.00')).toBeInTheDocument();
  });

  it('should calculate sum and average for different numbers', () => {
    const numbers = [5, 15, 25];
    render(<NumberStats numbers={numbers} />);
    
    expect(screen.getByText('Sum: 45')).toBeInTheDocument();
    expect(screen.getByText('Average: 15.00')).toBeInTheDocument();
  });

  it('should handle empty array', () => {
    render(<NumberStats numbers={[]} />);
    
    expect(screen.getByText('Count: 0')).toBeInTheDocument();
    expect(screen.getByText('Sum: 0')).toBeInTheDocument();
    expect(screen.getByText('Average: 0.00')).toBeInTheDocument();
  });

  it('should not recalculate sum when forcing re-render with same numbers', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const numbers = [1, 2, 3];
    
    render(<NumberStats numbers={numbers} />);
    
    // Initial calculation
    expect(consoleSpy).toHaveBeenCalledWith('Calculating sum...');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    
    consoleSpy.mockClear();
    
    // Force re-render
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    // Should NOT recalculate since numbers haven't changed
    expect(consoleSpy).not.toHaveBeenCalledWith('Calculating sum...');
    
    consoleSpy.mockRestore();
  });

  it('should recalculate when numbers prop changes', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const { rerender } = render(<NumberStats numbers={[1, 2, 3]} />);
    
    expect(screen.getByText('Sum: 6')).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    
    consoleSpy.mockClear();
    
    // Change numbers prop
    rerender(<NumberStats numbers={[4, 5, 6]} />);
    
    // Should recalculate with new numbers
    expect(screen.getByText('Sum: 15')).toBeInTheDocument();
    expect(consoleSpy).toHaveBeenCalledWith('Calculating sum...');
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    
    consoleSpy.mockRestore();
  });
});
```