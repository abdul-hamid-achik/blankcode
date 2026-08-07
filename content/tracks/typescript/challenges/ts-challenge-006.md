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

Write your complete implementation below:

```typescript
// Your implementation here
```

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

## Tests

```typescript
import { describe, it, expect } from 'vitest'
import { QueryBuilder } from './solution'

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

## Solution

```typescript
export type WhereValue =
  | string
  | number
  | boolean
  | null
  | { gt: number | string }
  | { lt: number | string }
  | { gte: number | string }
  | { lte: number | string }
  | { in: (string | number)[] }
  | { like: string }

export type WhereCondition = Record<string, WhereValue>

export class QueryBuilder {
  #columns: string[] = []
  #table = ''
  #conditions: WhereCondition[] = []
  #orders: string[] = []
  #limit: number | null = null
  #offset: number | null = null
  #joins: { table: string; on: string }[] = []

  select(...columns: string[]): QueryBuilder {
    this.#columns = columns
    return this
  }

  from(table: string): QueryBuilder {
    this.#table = table
    return this
  }

  where(condition: WhereCondition): QueryBuilder {
    // Accumulated rather than replaced, so repeated calls read as AND — which
    // is what chaining implies.
    this.#conditions.push(condition)
    return this
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): QueryBuilder {
    this.#orders.push(`${column} ${direction}`)
    return this
  }

  limit(n: number): QueryBuilder {
    this.#limit = n
    return this
  }

  offset(n: number): QueryBuilder {
    this.#offset = n
    return this
  }

  join(table: string, on: string): QueryBuilder {
    this.#joins.push({ table, on })
    return this
  }

  build(): { query: string; params: any[] } {
    const params: any[] = []
    // Every value goes through here, so nothing a caller supplies is ever
    // concatenated into the SQL text. That is the whole point of the builder.
    const placeholder = (value: any): string => {
      params.push(value)
      return `$${params.length}`
    }

    const parts = [`SELECT ${this.#columns.join(', ')}`, `FROM ${this.#table}`]

    for (const { table, on } of this.#joins) {
      parts.push(`JOIN ${table} ON ${on}`)
    }

    const clauses: string[] = []
    for (const condition of this.#conditions) {
      for (const [column, value] of Object.entries(condition)) {
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          const [operator, operand] = Object.entries(value)[0]!
          switch (operator) {
            case 'gt':
              clauses.push(`${column} > ${placeholder(operand)}`)
              break
            case 'lt':
              clauses.push(`${column} < ${placeholder(operand)}`)
              break
            case 'gte':
              clauses.push(`${column} >= ${placeholder(operand)}`)
              break
            case 'lte':
              clauses.push(`${column} <= ${placeholder(operand)}`)
              break
            case 'like':
              clauses.push(`${column} LIKE ${placeholder(operand)}`)
              break
            case 'in': {
              const values = (operand as (string | number)[]).map(placeholder)
              clauses.push(`${column} IN (${values.join(', ')})`)
              break
            }
            default:
              throw new Error(`Unknown operator: ${operator}`)
          }
          continue
        }
        clauses.push(`${column} = ${placeholder(value)}`)
      }
    }

    if (clauses.length > 0) parts.push(`WHERE ${clauses.join(' AND ')}`)
    if (this.#orders.length > 0) parts.push(`ORDER BY ${this.#orders.join(', ')}`)
    if (this.#limit !== null) parts.push(`LIMIT ${placeholder(this.#limit)}`)
    if (this.#offset !== null) parts.push(`OFFSET ${placeholder(this.#offset)}`)

    return { query: parts.join(' '), params }
  }
}
```
