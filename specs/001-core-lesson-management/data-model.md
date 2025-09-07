# Data Model: Core Lesson Management

**Feature**: Core Lesson Management (001-core-lesson-management)
**Date**: 2025-01-07
**Phase**: Design Complete

## Entity Analysis

### Lesson Entity (Existing Model - Extensions Required)

**Current State**: The Lesson model already exists in prisma/schema.prisma with comprehensive fields.

**Existing Fields**:
```typescript
model Lesson {
  id: String @id @default(cuid())
  title: String @db.VarChar(200)         // FR-004: Max 200 characters
  description: String? @db.Text          // FR-005: Required, non-empty
  content: String @db.Text               // Main lesson content
  objectives: String[] @default([])      // FR-007: Learning objectives
  keyQuestions: String[] @default([])    // FR-008: Key questions for AI
  facilitationStyle: String @default("exploratory") // FR-009: exploratory, analytical, ethical
  suggestedDuration: Int?                // FR-010: Optional duration in minutes
  suggestedGroupSize: Int @default(3)    // FR-010: Optional group size
  
  creatorId: String                      // FR-023: Lesson ownership
  creator: User @relation("CreatedLessons")
  
  isPublished: Boolean @default(false)   // FR-014: Lifecycle state
  isArchived: Boolean @default(false)    // FR-014: Lifecycle state
  
  createdAt: DateTime @default(now())    // FR-012: Creation timestamp
  updatedAt: DateTime @updatedAt         // FR-012: Update timestamp
  publishedAt: DateTime?                 // Track when published
}
```

**Required Extensions**: None - existing model fully supports all functional requirements.

## State Transitions

### Lesson Lifecycle (FR-014, FR-015, FR-016)

```
Draft (isPublished: false, isArchived: false)
  ↓ (publish action)
Published (isPublished: true, isArchived: false)
  ↓ (archive action)
Archived (isPublished: true, isArchived: true)
```

**Transition Rules**:
- Draft → Published: Allowed (FR-014)
- Published → Draft: **FORBIDDEN** (FR-015)
- Published → Archived: Allowed (FR-016)
- Archived → Published: **FORBIDDEN** (business rule)
- Archived → Draft: Via fork operation only (FR-021)

## Validation Rules

### Field Validation (from Functional Requirements)

**Title** (FR-004):
- Required: Yes
- Max length: 200 characters
- Type: String
- Validation: `z.string().min(1).max(200)`

**Description** (FR-005):
- Required: Yes (must be non-empty)
- Type: Text
- Validation: `z.string().min(1)`

**Content**:
- Required: Yes
- Type: Text
- Validation: `z.string().min(1)`

**Objectives** (FR-007):
- Required: No
- Type: Array of strings
- Validation: `z.array(z.string()).default([])`

**Key Questions** (FR-008):
- Required: No  
- Type: Array of strings
- Validation: `z.array(z.string()).default([])`

**Facilitation Style** (FR-009):
- Required: Yes
- Allowed values: "exploratory", "analytical", "ethical"
- Default: "exploratory"
- Validation: `z.enum(["exploratory", "analytical", "ethical"])`

**Suggested Duration** (FR-010):
- Required: No
- Type: Integer (minutes)
- Validation: `z.number().int().positive().optional()`

**Suggested Group Size** (FR-010):
- Required: No (has default)
- Type: Integer
- Default: 3
- Validation: `z.number().int().positive().default(3)`

## Relationships

### Existing Relationships
- **User ↔ Lesson**: One-to-Many (creatorId) - FR-023 lesson ownership
- **Lesson ↔ Discussion**: One-to-Many (lessonId) - lessons can be used in multiple discussions

### No Additional Relationships Required
The existing relationships fully support the lesson management requirements.

## Data Access Patterns

### Query Patterns
1. **List user's lessons** (FR-011): `WHERE creatorId = userId ORDER BY updatedAt DESC`
2. **Filter by status**: 
   - Drafts: `WHERE isPublished = false AND isArchived = false`
   - Published: `WHERE isPublished = true AND isArchived = false`
   - Archived: `WHERE isArchived = true`

### Mutation Patterns
1. **Create lesson** (FR-003): INSERT with default values
2. **Update lesson** (FR-013): UPDATE WHERE id = ? AND creatorId = ?
3. **Publish lesson** (FR-014): UPDATE isPublished = true, publishedAt = now()
4. **Archive lesson** (FR-016): UPDATE isArchived = true
5. **Delete lesson** (FR-017): DELETE WHERE id = ? AND creatorId = ?
6. **Fork lesson** (FR-021): INSERT new lesson copying archived lesson data

## Indexing Strategy

### Existing Indexes (Adequate)
```sql
@@index([creatorId])              -- For listing user's lessons
@@index([isPublished, isArchived]) -- For status filtering
```

These indexes support all required query patterns efficiently.

## Version Control Considerations

### Current Approach (Adequate for MVP)
- Single lesson record with `updatedAt` timestamp
- **FR-019**: Lesson versions for ongoing discussions handled at application level
- **FR-020**: Optional updates to active discussions handled via business logic

### Future Enhancements (Out of Scope)
- Dedicated LessonVersion table for full audit trail
- Discussion snapshot isolation for lesson changes

## Summary

**Model Status**: ✅ READY - Existing Prisma Lesson model fully supports all functional requirements with no schema changes needed.

**Validation**: All functional requirements (FR-001 through FR-023) are supported by current data model structure.

**Performance**: Existing indexes support efficient querying for all required access patterns.

**Next Phase**: API contract design can proceed using existing Lesson model as-is.