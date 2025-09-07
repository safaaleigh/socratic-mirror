# Quickstart: Core Lesson Management Testing

**Feature**: Core Lesson Management (001-core-lesson-management)
**Date**: 2025-01-07
**Purpose**: Integration test scenarios for lesson CRUD operations

## Prerequisites

```bash
# 1. Database setup
npm run db:push

# 2. Start development server  
npm run dev

# 3. Ensure authenticated user session exists
```

## Test Scenario 1: Basic Lesson CRUD (Happy Path)

### Step 1: Create New Lesson (FR-003, FR-006)
```typescript
// Expected: Lesson created in draft status
const newLesson = await trpc.lesson.create.mutate({
  title: "Introduction to Critical Thinking",
  description: "A lesson on developing analytical skills",
  content: "Students will learn to evaluate arguments and identify logical fallacies",
  objectives: ["Identify logical fallacies", "Construct valid arguments"],
  keyQuestions: ["What makes an argument valid?", "How do we identify bias?"],
  facilitationStyle: "analytical",
  suggestedDuration: 45,
  suggestedGroupSize: 4
});

// Verify: Lesson exists in draft state
assert(newLesson.status === "draft");
assert(newLesson.isPublished === false);
assert(newLesson.isArchived === false);
```

### Step 2: List User's Lessons (FR-011)
```typescript
// Expected: New lesson appears in user's lesson list
const lessons = await trpc.lesson.list.query();
assert(lessons.find(l => l.id === newLesson.id));
assert(lessons.every(l => l.creatorId === currentUserId));
```

### Step 3: Update Lesson Content (FR-013)
```typescript
// Expected: Lesson content updated, timestamps refreshed
const updatedLesson = await trpc.lesson.update.mutate({
  id: newLesson.id,
  title: "Advanced Critical Thinking",
  objectives: [...newLesson.objectives, "Apply critical thinking to real scenarios"]
});

assert(updatedLesson.title === "Advanced Critical Thinking");
assert(updatedLesson.objectives.length === 3);
assert(updatedLesson.updatedAt > newLesson.updatedAt);
```

### Step 4: Publish Lesson (FR-014)
```typescript
// Expected: Lesson state changes to published
const publishedLesson = await trpc.lesson.publish.mutate({
  id: newLesson.id
});

assert(publishedLesson.status === "published");
assert(publishedLesson.isPublished === true);
assert(publishedLesson.publishedAt !== null);
```

## Test Scenario 2: Lesson Lifecycle Transitions (FR-014, FR-015, FR-016)

### Step 1: Verify Published Lesson Cannot Revert (FR-015)
```typescript
// Expected: Error when trying to unpublish
await expect(
  trpc.lesson.update.mutate({
    id: publishedLesson.id,
    // No direct way to set isPublished = false in update
  })
).rejects.toThrow("BAD_REQUEST");
```

### Step 2: Archive Published Lesson (FR-016)
```typescript
// Expected: Lesson archived successfully
const archivedLesson = await trpc.lesson.archive.mutate({
  id: publishedLesson.id
});

assert(archivedLesson.status === "archived");
assert(archivedLesson.isArchived === true);
assert(archivedLesson.isPublished === true); // Remains published
```

## Test Scenario 3: Lesson Deletion & Discussion Handling (FR-017, FR-018)

### Step 1: Create Lesson with Active Discussion
```typescript
// Create lesson and simulate active discussion
const lessonWithDiscussion = await trpc.lesson.create.mutate({
  title: "Ethics in Technology", 
  description: "Exploring ethical considerations in tech",
  content: "Discussion on AI ethics and privacy"
});

// Publish lesson
await trpc.lesson.publish.mutate({ id: lessonWithDiscussion.id });

// Create discussion using this lesson (simulation)
// In real test: await trpc.discussion.create.mutate({ lessonId: lessonWithDiscussion.id })
```

### Step 2: Delete Lesson with Discussion Completion Option (FR-018)
```typescript
// Expected: Lesson deleted, discussions allowed to complete
const deleteResult = await trpc.lesson.delete.mutate({
  id: lessonWithDiscussion.id,
  handleActiveDiscussions: "complete"
});

assert(deleteResult.success === true);
assert(deleteResult.affectedDiscussions >= 0);

// Verify lesson is deleted
await expect(
  trpc.lesson.getById.query({ id: lessonWithDiscussion.id })
).rejects.toThrow("NOT_FOUND");
```

## Test Scenario 4: Lesson Forking (FR-021)

### Step 1: Fork Archived Lesson
```typescript
// Expected: New draft lesson created from archived lesson
const forkedLesson = await trpc.lesson.fork.mutate({
  id: archivedLesson.id,
  newTitle: "Advanced Ethics in Technology"
});

assert(forkedLesson.status === "draft");
assert(forkedLesson.title === "Advanced Ethics in Technology");
assert(forkedLesson.content === archivedLesson.content); // Content copied
assert(forkedLesson.objectives.length === archivedLesson.objectives.length);
assert(forkedLesson.id !== archivedLesson.id); // New lesson
```

### Step 2: Verify Fork Restrictions
```typescript
// Expected: Cannot fork non-archived lessons
await expect(
  trpc.lesson.fork.mutate({
    id: newLesson.id // Draft lesson
  })
).rejects.toThrow("BAD_REQUEST");
```

## Test Scenario 5: Validation & Security (FR-004, FR-005, FR-023)

### Step 1: Title Length Validation (FR-004)
```typescript
// Expected: Error for title exceeding 200 characters
const longTitle = "A".repeat(201);
await expect(
  trpc.lesson.create.mutate({
    title: longTitle,
    description: "Valid description",
    content: "Valid content"
  })
).rejects.toThrow("VALIDATION_ERROR");
```

### Step 2: Required Description Validation (FR-005)
```typescript
// Expected: Error for empty description
await expect(
  trpc.lesson.create.mutate({
    title: "Valid Title",
    description: "",
    content: "Valid content"
  })
).rejects.toThrow("VALIDATION_ERROR");
```

### Step 3: Lesson Ownership Security (FR-023)
```typescript
// Expected: Cannot access other user's lessons
// This would require test user context switching
// await switchUser(otherUserId);
// await expect(
//   trpc.lesson.update.mutate({
//     id: newLesson.id,
//     title: "Unauthorized update"
//   })
// ).rejects.toThrow("FORBIDDEN");
```

## Test Scenario 6: UI Integration (FR-001, FR-002)

### Step 1: Verify Sidebar Navigation
```typescript
// Frontend integration test
// Expected: "Lessons" appears in sidebar navigation
const sidebar = await page.locator('[data-testid="sidebar"]');
const lessonsLink = sidebar.locator('text=Lessons');
await expect(lessonsLink).toBeVisible();
```

### Step 2: Verify Mock Lessons Removed (FR-002)  
```typescript
// Expected: No mock lesson entries in navigation
const mockLessons = sidebar.locator('text=Mock Lesson');
await expect(mockLessons).toHaveCount(0);
```

## Performance Validation

### Response Time Tests
```typescript
// Expected: Lesson operations complete within 2 seconds
const startTime = Date.now();
await trpc.lesson.list.query();
const duration = Date.now() - startTime;
assert(duration < 2000);
```

### Concurrent User Tests
```typescript
// Expected: Multiple users can create lessons simultaneously
const promises = Array.from({ length: 5 }, (_, i) =>
  trpc.lesson.create.mutate({
    title: `Concurrent Lesson ${i}`,
    description: `Description ${i}`,
    content: `Content ${i}`
  })
);

const results = await Promise.all(promises);
assert(results.every(lesson => lesson.status === "draft"));
assert(new Set(results.map(l => l.id)).size === 5); // All unique
```

## Cleanup

```bash
# Reset database after testing
npm run db:push --force-reset
```

## Success Criteria

All test scenarios must pass to validate that the lesson management system meets functional requirements FR-001 through FR-023.

**Key Validations**:
- ✅ CRUD operations work for lesson lifecycle
- ✅ State transitions follow business rules  
- ✅ Data validation prevents invalid inputs
- ✅ Authorization ensures lesson ownership
- ✅ UI integration provides seamless experience
- ✅ Performance meets <2s response time goals