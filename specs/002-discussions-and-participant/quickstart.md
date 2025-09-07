# Quickstart: Discussions and Participant Experience

**Feature**: Discussion creation with participant invitations  
**Date**: 2025-01-07  
**Prerequisites**: Completed lesson management system, authenticated user

## Quick Test Scenarios

### 1. Create Discussion from Lesson
```bash
# Prerequisites
- User logged in with Discord auth
- At least one published lesson exists

# Steps
1. Navigate to /lessons
2. Select a published lesson
3. Click "Create Discussion" button
4. Fill in discussion details:
   - Name: "Critical Thinking Workshop"
   - Description: "Exploring logical fallacies"
   - Max participants: 10
5. Click "Create"

# Expected Result
- Discussion created with unique ID
- Redirected to discussion page
- User is CREATOR role participant
```

### 2. Invite Participants via Email
```bash
# Prerequisites
- Discussion created (from scenario 1)
- Email service configured

# Steps
1. On discussion page, click "Invite Participants"
2. Enter email addresses:
   - student1@example.com
   - student2@example.com
3. Add personal message (optional)
4. Click "Send Invitations"

# Expected Result
- Emails sent to recipients
- Invitations shown as PENDING
- Each email contains unique token link
```

### 3. Join Discussion via Invitation Link
```bash
# Prerequisites
- Valid invitation link received

# Steps
1. Click invitation link in email
2. If not logged in:
   - Create account or login
3. View discussion preview
4. Click "Join Discussion"

# Expected Result
- Added as PARTICIPANT to discussion
- Can see lesson content
- Can view/send messages
```

### 4. Participate in AI-Facilitated Discussion
```bash
# Prerequisites
- Joined discussion as participant
- AI service configured

# Steps
1. View initial AI prompt based on lesson
2. Type response in message box
3. Send message
4. Wait for AI facilitator response

# Expected Result
- Message appears in real-time
- AI responds with Socratic question
- Other participants see messages
```

### 5. Create Shareable Join Link
```bash
# Prerequisites
- Discussion creator logged in

# Steps
1. Navigate to discussion settings
2. Click "Generate Join Link"
3. Set expiration (7 days)
4. Copy link

# Expected Result
- Unique 8-character join code created
- Shareable link generated
- Link expires after set time
```

## Command Line Testing

### Setup Test Environment
```bash
# Install dependencies
bun install

# Setup database
bun run db:push

# Start development server
bun run dev

# In another terminal, run tests
bun test tests/discussion/
```

### API Testing with cURL
```bash
# Create discussion (requires auth token)
curl -X POST http://localhost:3000/api/trpc/discussion.create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "lessonId": "clxxx...",
    "name": "Test Discussion",
    "maxParticipants": 5
  }'

# Join with code
curl -X POST http://localhost:3000/api/trpc/discussion.join \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "joinCode": "ABC12345"
  }'

# Send message
curl -X POST http://localhost:3000/api/trpc/message.send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "discussionId": "clyyy...",
    "content": "What is the main argument?"
  }'
```

### WebSocket Testing
```javascript
// Connect to WebSocket for real-time updates
const ws = new WebSocket('ws://localhost:3001');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    discussionId: 'clyyy...',
    token: authToken
  }));
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Event:', event.type, event.data);
});
```

## Test Data Setup

### Seed Script
```typescript
// scripts/seed-discussions.ts
import { db } from "@/server/db";

async function seed() {
  // Create test user
  const user = await db.user.create({
    data: {
      email: "teacher@example.com",
      name: "Test Teacher",
    },
  });

  // Create test lesson
  const lesson = await db.lesson.create({
    data: {
      title: "Introduction to Logic",
      content: "Understanding logical arguments...",
      creatorId: user.id,
      isPublished: true,
      objectives: ["Identify fallacies", "Construct arguments"],
      keyQuestions: ["What makes an argument valid?"],
    },
  });

  // Create test discussion
  const discussion = await db.discussion.create({
    data: {
      name: "Logic Workshop Group A",
      lessonId: lesson.id,
      creatorId: user.id,
      maxParticipants: 10,
    },
  });

  // Add creator as participant
  await db.discussionParticipant.create({
    data: {
      discussionId: discussion.id,
      userId: user.id,
      role: "CREATOR",
    },
  });

  console.log("Seed complete:", { user, lesson, discussion });
}

seed();
```

## Verification Checklist

### Functional Requirements
- [ ] Can create discussion from published lesson
- [ ] Can set participant limits
- [ ] Can invite via email
- [ ] Can generate shareable links
- [ ] Participants can join discussions
- [ ] Messages display in real-time
- [ ] AI facilitator responds appropriately
- [ ] Can close discussions
- [ ] Participant dashboard shows all discussions

### Access Control
- [ ] Only see lessons for invited discussions
- [ ] Cannot join without invitation
- [ ] Cannot exceed participant limit
- [ ] Creator can manage discussion
- [ ] Moderators can remove participants

### Edge Cases
- [ ] Invalid invitation rejected
- [ ] Expired invitations handled
- [ ] Full discussions prevent joining
- [ ] Deleted lessons preserve discussions
- [ ] Account creation during join works

## Performance Targets
- Page load: < 2 seconds
- Message delivery: < 500ms
- AI response: < 3 seconds
- Support 50+ participants
- Handle 100+ concurrent discussions

## Troubleshooting

### Common Issues

**Issue**: Invitations not sending
- Check: RESEND_API_KEY environment variable
- Check: Email service logs
- Verify: Recipient email format

**Issue**: Real-time updates not working
- Check: WebSocket connection established
- Check: WS_PORT configuration
- Verify: Authentication on WebSocket

**Issue**: AI not responding
- Check: OPENAI_API_KEY environment variable
- Check: AI service logs
- Verify: Lesson has key questions

**Issue**: Cannot join discussion
- Check: Invitation status (not expired)
- Check: Participant limit not exceeded
- Verify: User authenticated

## Next Steps

After quickstart validation:
1. Run integration tests
2. Perform load testing
3. Review security measures
4. Document API endpoints
5. Create user guide