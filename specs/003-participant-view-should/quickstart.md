# Quickstart: Participant View Validation

## Prerequisites
- Running Next.js application with existing lesson and discussion management
- PostgreSQL database with participant schema extensions
- Test discussion created and in 'active' status
- Valid invitation token generated for test discussion

## Test Scenarios

### Scenario 1: Valid Invitation Link Access
**Story**: As an invitee, I can click a valid invitation link and see the name entry screen

**Setup**:
```bash
# Create test discussion with invitation
bun run test:setup -- --scenario="valid-invitation"
```

**Steps**:
1. Open invitation link: `http://localhost:3000/join/[discussionId]?token=[jwt-token]`
2. **Verify**: Page loads with discussion title and name entry form
3. **Verify**: No authentication required
4. **Verify**: Form has text input for display name and "Join Discussion" button

**Expected Result**: Name entry page displayed with correct discussion context

---

### Scenario 2: Participant Name Entry and Join
**Story**: As an invitee, I can enter my name and join the live discussion

**Setup**: Continue from Scenario 1

**Steps**:
1. Enter display name: "Alice"
2. Click "Join Discussion" button
3. **Verify**: Redirected to discussion view at `/discussion/[id]/participant`
4. **Verify**: Can see message history (if any exists)
5. **Verify**: Message input is available and functional
6. **Verify**: Participant count updated to show "1 participant"

**Expected Result**: Successfully joined discussion with real-time messaging interface

---

### Scenario 3: Real-time Message Sending
**Story**: As a participant, I can send messages that other participants see in real-time

**Setup**: Two browser sessions joined as "Alice" and "Bob"

**Steps**:
1. **Alice**: Type message "Hello everyone!" and send
2. **Verify**: Alice sees message immediately (optimistic UI)
3. **Verify**: Bob receives message within 1 second
4. **Bob**: Reply with "Hi Alice!"  
5. **Verify**: Alice receives Bob's message within 1 second
6. **Verify**: Message order preserved chronologically

**Expected Result**: Bi-directional real-time messaging working correctly

---

### Scenario 4: Message History Display
**Story**: As a new participant, I can see discussion history for context

**Setup**: Discussion with 25 existing messages

**Steps**:
1. **Charlie**: Join discussion via invitation link
2. **Verify**: Last 20 messages displayed on join
3. **Verify**: Messages show sender names and timestamps
4. **Verify**: Scroll up triggers lazy loading of earlier messages
5. **Verify**: Loading indicator shown during history fetch
6. **Verify**: Earlier messages loaded successfully

**Expected Result**: Full message history accessible with performance optimization

---

### Scenario 5: Multiple Participants with Same Name
**Story**: As an invitee, I can use any display name, including ones already taken

**Setup**: "Alice" already in discussion

**Steps**:
1. **Second participant**: Join with name "Alice"
2. **Verify**: Join successful (no duplicate name error)
3. **Both Alices**: Send different messages
4. **Verify**: Messages clearly attributed to each sender
5. **Verify**: Timestamps/context help distinguish participants

**Expected Result**: Duplicate names allowed and properly handled

---

### Scenario 6: Participant Leave Function
**Story**: As a participant, I can voluntarily leave a discussion

**Setup**: Alice joined as participant

**Steps**:
1. **Alice**: Click "Leave Discussion" button
2. **Verify**: Confirmation dialog appears
3. **Alice**: Confirm leave action
4. **Verify**: Redirected away from discussion
5. **Verify**: Other participants see "Alice has left" notification
6. **Verify**: Alice can rejoin using same invitation link

**Expected Result**: Clean participant exit with proper notifications

---

### Scenario 7: Invalid/Expired Invitation Handling
**Story**: As a user, I see clear error messages for invalid invitation links

**Test Cases**:

**7a. Expired Token**:
1. Use invitation with past expiration date
2. **Verify**: Error page with "Invitation has expired" message
3. **Verify**: Option to contact discussion creator

**7b. Invalid Token Format**:
1. Use malformed JWT token in URL
2. **Verify**: Error page with "Invalid invitation link" message

**7c. Discussion Not Found**:
1. Use valid token for non-existent discussion
2. **Verify**: Error page with "Discussion not found" message

**7d. Discussion Ended**:
1. Use valid token for completed/cancelled discussion
2. **Verify**: Error page with "Discussion has ended" message

**Expected Result**: Clear error handling for all invalid invitation scenarios

---

### Scenario 8: Connection Recovery
**Story**: As a participant, I can recover from temporary network issues

**Setup**: Alice joined and actively participating

**Steps**:
1. **Simulate**: Network disconnection (disable WiFi)
2. **Verify**: "Connection lost" indicator appears
3. **Alice**: Attempt to send message while offline
4. **Verify**: Message queued with "sending..." status
5. **Restore**: Network connection  
6. **Verify**: Automatic reconnection within 5 seconds
7. **Verify**: Queued message sent successfully
8. **Verify**: Any missed messages received

**Expected Result**: Graceful handling of network interruptions

---

## Performance Validation

### Load Test: Multiple Concurrent Participants
```bash
# Simulate 20 participants joining simultaneously
bun run test:load -- --participants=20 --discussion=[id]
```

**Acceptance Criteria**:
- All 20 participants can join within 10 seconds
- Message latency remains under 500ms
- No message loss or duplication
- Server memory usage remains stable

### Lazy Loading Performance
```bash  
# Test with discussion containing 500+ messages
bun run test:history -- --messages=500
```

**Acceptance Criteria**:
- Initial join completes within 2 seconds
- History pagination loads within 1 second per page
- UI remains responsive during loading
- No memory leaks from message accumulation

---

## Integration Validation

### With Existing Lesson System
1. Create lesson with discussion enabled
2. Generate participant invitation from lesson context
3. **Verify**: Invitation links to correct discussion
4. **Verify**: Lesson title/context visible in participant view

### With User Authentication  
1. Discussion creator (authenticated user) active in same discussion
2. Anonymous participants join
3. **Verify**: Both user and participant messages displayed correctly
4. **Verify**: Sender types clearly distinguished in UI
5. **Verify**: No permission conflicts between user types

---

## Cleanup Commands

```bash
# Clean up test data after validation
bun run test:cleanup -- --scenario=all

# Reset database to clean state  
bun run db:reset -- --confirm

# Clear any background processes
bun run test:stop-services
```

## Success Criteria Summary

✅ **Invitation System**: Valid links work, invalid links properly rejected  
✅ **Participant Management**: Join/leave functions work reliably  
✅ **Real-time Messaging**: Sub-second message delivery between participants  
✅ **Message History**: Efficient lazy loading of conversation history  
✅ **Error Handling**: Graceful degradation for network/server issues  
✅ **Performance**: Supports 20+ concurrent participants per discussion  
✅ **Integration**: Seamless integration with existing lesson/user systems

## Troubleshooting

**Issue**: Messages not appearing in real-time
- Check WebSocket/SSE connection status
- Verify participant session validation
- Check server-side message broadcasting

**Issue**: Invitation links not working  
- Verify JWT token generation and validation
- Check discussion status (must be 'active')
- Validate token expiration settings

**Issue**: Performance degradation with message history
- Check database indexing on message queries
- Verify lazy loading pagination limits
- Monitor memory usage during history loading