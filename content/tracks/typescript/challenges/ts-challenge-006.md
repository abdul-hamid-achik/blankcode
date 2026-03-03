---
slug: ts-challenge-006
title: 'Challenge: Build a Query Builder'
description: Create a type-safe SQL query builder with method chaining.
difficulty: expert
type: challenge
tags:
  - database
  - generics
  - template-literals
---

# Challenge: Type-Safe Query Builder

## Requirements

Create a `QueryBuilder` class with the following features:

1. **select(...columns: string[]): QueryBuilder** - Select columns
2. **from(table: string): QueryBuilder** - Specify table
3. **where(condition: WhereCondition): QueryBuilder** - Add WHERE clause
4. **orderBy(column: string, direction?: 'ASC' | 'DESC'): QueryBuilder** - Add ORDER BY
5. **limit(n: number): QueryBuilder** - Add LIMIT
6. **offset(n: number): QueryBuilder** - Add OFFSET
7. **join(table: string, on: string): QueryBuilder** - Add JOIN
8. **build(): { query: string, params: any[] }** - Build final query

## Constraints

- Method chaining support
- Parameterized queries (prevent SQL injection)
- Type-safe column references
- Support multiple WHERE conditions (AND/OR)
- Build valid SQL for PostgreSQL

## Example Usage

```typescript
const { query, params } = new QueryBuilder()
  .select('id', 'name', 'email')
  .from('users')
  .where({ age: { gt: 18 } })
  .where({ status: 'active' })
  .orderBy('created_at', 'DESC')
  .limit(10)
  .offset(20)
  .build()

// SELECT id, name, email FROM users 
// WHERE age > $1 AND status = $2 
// ORDER BY created_at DESC 
// LIMIT $3 OFFSET $4
// params: [18, 'active', 10, 20]
```

Write your complete implementation below:

```typescript
// Your implementation here
```

## Tests

```typescript
import { describe, it, expect } from 'vitest'
import { QueryBuilder } from './QueryBuilder'

describe('QueryBuilder', () => {
  it('should build simple SELECT query', () => {
    const { query, params } = new QueryBuilder()
      .select('id', 'name')
      .from('users')
      .build()
    
    expect(query).toBe('SELECT id, name FROM users')
    expect(params).toEqual([])
  })

  it('should build SELECT with WHERE equality', () => {
    const { query, params } = new QueryBuilder()
      .select('*')
      .from('users')
      .where({ id: 1 })
      .build()
    
    expect(query).toBe('SELECT * FROM users WHERE id = $1')
    expect(params).toEqual([1])
  })

  it('should build SELECT with WHERE greater than', () => {
    const { query, params } = new QueryBuilder()
      .select('*')
      .from('products')
      .where({ price: { gt: 100 } })
      .build()
    
    expect(query).toBe('SELECT * FROM products WHERE price > $1')
    expect(params).toEqual([100])
  })

  it('should build SELECT with WHERE less than', () => {
    const { query, params } = new QueryBuilder()
      .select('*')
      .from('products')
      .where({ price: { lt: 50 } })
      .build()
    
    expect(query).toBe('SELECT * FROM products WHERE price < $1')
    expect(params).toEqual([50])
  })

  it('should build SELECT with WHERE IN', () => {
    const { query, params } = new QueryBuilder()
      .select('*')
      .from('users')
      .where({ status: { in: ['active', 'pending'] } })
      .build()
    
    expect(query).toBe('SELECT * FROM users WHERE status IN ($1, $2)')
    expect(params).toEqual(['active', 'pending'])
  })

  it('should build SELECT with WHERE LIKE', () => {
    const { query, params } = new QueryBuilder()
      .select('*')
      .from('users')
      .where({ name: { like: '%john%' } })
      .build()
    
    expect(query).toBe('SELECT * FROM users WHERE name LIKE $1')
    expect(params).toEqual(['%john%'])
  })

  it('should build SELECT with multiple WHERE conditions', () => {
    const { query, params } = new QueryBuilder()
      .select('*')
      .from('users')
      .where({ age: { gt: 18 } })
      .where({ status: 'active' })
      .build()
    
    expect(query).toBe('SELECT * FROM users WHERE age > $1 AND status = $2')
    expect(params).toEqual([18, 'active'])
  })

  it('should build SELECT with ORDER BY', () => {
    const { query, params } = new QueryBuilder()
      .select('*')
      .from('users')
      .orderBy('created_at', 'DESC')
      .build()
    
    expect(query).toBe('SELECT * FROM users ORDER BY created_at DESC')
  })

  it('should build SELECT with LIMIT and OFFSET', () => {
    const { query, params } = new QueryBuilder()
      .select('*')
      .from('users')
      .limit(10)
      .offset(20)
      .build()
    
    expect(query).toBe('SELECT * FROM users LIMIT $1 OFFSET $2')
    expect(params).toEqual([10, 20])
  })

  it('should build SELECT with JOIN', () => {
    const { query, params } = new QueryBuilder()
      .select('users.id', 'users.name', 'orders.total')
      .from('users')
      .join('orders', 'users.id = orders.user_id')
      .build()
    
    expect(query).toBe(
      'SELECT users.id, users.name, orders.total FROM users ' +
      'JOIN orders ON users.id = orders.user_id'
    )
  })

  it('should build complex query with all clauses', () => {
    const { query, params } = new QueryBuilder()
      .select('u.id', 'u.name', 'COUNT(o.id) as order_count')
      .from('users u')
      .join('orders o', 'u.id = o.user_id')
      .where({ status: 'active' })
      .where({ age: { gt: 18 } })
      .orderBy('order_count', 'DESC')
      .limit(10)
      .offset(0)
      .build()
    
    expect(query).toContain('SELECT')
    expect(query).toContain('FROM users u')
    expect(query).toContain('JOIN orders')
    expect(query).toContain('WHERE')
    expect(query).toContain('ORDER BY')
    expect(query).toContain('LIMIT')
    expect(query).toContain('OFFSET')
  })

  it('should handle string values correctly', () => {
    const { query, params } = new QueryBuilder()
      .select('*')
      .from('users')
      .where({ email: 'test@example.com' })
      .build()
    
    expect(query).toBe('SELECT * FROM users WHERE email = $1')
    expect(params).toEqual(['test@example.com'])
  })

  it('should handle boolean values correctly', () => {
    const { query, params } = new QueryBuilder()
      .select('*')
      .from('users')
      .where({ active: true })
      .build()
    
    expect(query).toBe('SELECT * FROM users WHERE active = $1')
    expect(params).toEqual([true])
  })
})
```
