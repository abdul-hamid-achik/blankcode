---
slug: python-datastructures-student-grades
title: Student Grades Manager
description: Practice working with lists and dictionaries by creating a simple grade management system that stores student information and calculates averages.
difficulty: beginner
hints:
  - Use square brackets [] to create a list
  - Dictionary keys are strings, use quotes around them
  - The append() method adds items to the end of a list
  - Access dictionary values using dictionary[key] syntax
tags:
  - python
  - data-structures
  - lists
  - dictionaries
  - beginner
---

In this exercise, you'll create a simple student grade manager. You'll work with a dictionary to store student information and a list to store their test scores.

Complete the code by filling in the blanks to:
1. Create a dictionary with student information
2. Create a list of test scores
3. Add a new score to the list
4. Access and calculate the average of the scores

```python
# Create a dictionary to store student information
student = {
    "name": "Alice Johnson",
    "student_id": "12345",
    ___blank_start___"grades": []___blank_end___
}

# Create a list of test scores
test_scores = ___blank_start___[85, 92, 78, 90]___blank_end___

# Add the test scores to the student's grades
student["grades"] = test_scores

# Add a new test score of 88 to the grades list
student["grades"].___blank_start___append(88)___blank_end___

# Calculate the average grade
total = sum(student["grades"])
count = len(student["grades"])
average = ___blank_start___total / count___blank_end___

print(f"{student['name']} has an average grade of {average:.2f}")
```

## Tests

```typescript
import { describe, it, expect } from 'vitest';
import { runPython } from './python-runner'; // Assuming a Python runner utility

describe('Student Grades Manager', () => {
  it('should create a dictionary with a grades key containing an empty list', async () => {
    const code = `
student = {
    "name": "Alice Johnson",
    "student_id": "12345",
    "grades": []
}
print(type(student["grades"]).__name__)
print(len(student["grades"]))
    `;
    const result = await runPython(code);
    expect(result).toContain('list');
    expect(result).toContain('0');
  });

  it('should create a list with four test scores', async () => {
    const code = `
test_scores = [85, 92, 78, 90]
print(type(test_scores).__name__)
print(len(test_scores))
print(test_scores[0])
    `;
    const result = await runPython(code);
    expect(result).toContain('list');
    expect(result).toContain('4');
    expect(result).toContain('85');
  });

  it('should append a new score to the grades list', async () => {
    const code = `
student = {"grades": [85, 92, 78, 90]}
student["grades"].append(88)
print(len(student["grades"]))
print(student["grades"][-1])
    `;
    const result = await runPython(code);
    expect(result).toContain('5');
    expect(result).toContain('88');
  });

  it('should calculate the correct average', async () => {
    const code = `
grades = [85, 92, 78, 90, 88]
total = sum(grades)
count = len(grades)
average = total / count
print(f"{average:.2f}")
    `;
    const result = await runPython(code);
    expect(result).toContain('86.60');
  });

  it('should complete the full exercise correctly', async () => {
    const code = `
student = {
    "name": "Alice Johnson",
    "student_id": "12345",
    "grades": []
}
test_scores = [85, 92, 78, 90]
student["grades"] = test_scores
student["grades"].append(88)
total = sum(student["grades"])
count = len(student["grades"])
average = total / count
print(student["name"])
print(len(student["grades"]))
print(f"{average:.2f}")
    `;
    const result = await runPython(code);
    expect(result).toContain('Alice Johnson');
    expect(result).toContain('5');
    expect(result).toContain('86.60');
  });
});
```