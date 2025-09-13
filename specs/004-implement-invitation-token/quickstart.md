# Quickstart: Invitation Token Handler Page

**Feature**: 004-implement-invitation-token  
**Date**: 2025-09-09

## Overview

This quickstart provides step-by-step validation of the invitation token handler page functionality. All scenarios should pass before the feature is considered complete.

## Prerequisites

- ✅ Next.js development server running (`bun run dev`)
- ✅ Database with test data via `bun run db:push`
- ✅ Test invitation tokens created via existing invitation system

## Test Scenarios

### 1. Valid Invitation Flow (Anonymous User)

**Objective**: Verify complete anonymous user invitation acceptance

**Steps**:
1. **Create Test Invitation**:
   ```bash
   # Use existing invitation system to create a test invitation
   # Navigate to a discussion as creator
   # Click "Invite" button → "Invitation Link" tab → "Generate Invitation Link"
   # Copy the generated URL (format: http://localhost:3000/invitations/{token})
   ```

2. **Access Invitation Page**:
   - Open invitation URL in incognito/private browser window
   - **Expected**: Page loads with invitation details
   - **Verify**: Shows sender name, discussion title, accept button

3. **Provide Participant Name**:
   - Enter name "Test Participant" in name input field
   - **Verify**: Input accepts 1-50 character names
   - **Verify**: Validation shows for empty names

4. **Accept Invitation**:
   - Click "Join Discussion" button
   - **Expected**: Loading state shows briefly
   - **Expected**: Redirect to discussion participant view
   - **Expected**: Can see discussion messages and send messages

5. **Verify Participation**:
   - Check discussion participant list shows "Test Participant"
   - Send a test message as anonymous participant
   - **Expected**: Message appears with "Test Participant" as sender

**Success Criteria**: ✅ Anonymous user successfully joins discussion via invitation link

---

### 2. Expired Invitation Handling

**Objective**: Verify expired invitation shows appropriate error

**Steps**:
1. **Create Expired Invitation**:
   ```sql
   -- Manually expire a test invitation in database
   UPDATE "Invitation" 
   SET "expiresAt" = '2025-09-08T00:00:00Z' 
   WHERE "token" = 'test_token_here';
   ```

2. **Access Expired Link**:
   - Navigate to expired invitation URL
   - **Expected**: Page shows "Invitation has expired" error
   - **Expected**: No accept button displayed
   - **Expected**: Clear messaging about expiration

**Success Criteria**: ✅ Expired invitations show user-friendly error messages

---

### 3. Invalid Token Handling

**Objective**: Verify invalid tokens show appropriate errors

**Steps**:
1. **Access Invalid Token URL**:
   - Navigate to `http://localhost:3000/invitations/invalid_token_123`
   - **Expected**: Page shows "Invitation not found" error
   - **Expected**: No invitation details displayed

2. **Access Malformed URL**:
   - Navigate to `http://localhost:3000/invitations/`
   - **Expected**: Next.js 404 page or proper error handling

**Success Criteria**: ✅ Invalid tokens handled gracefully with clear error messages

---

### 4. Full Discussion Handling

**Objective**: Verify behavior when discussion is at capacity

**Steps**:
1. **Create Limited Discussion**:
   - Create discussion with `maxParticipants: 2`
   - Add 2 participants manually
   - Generate invitation for full discussion

2. **Attempt Join**:
   - Use invitation link to access page
   - Try to join with participant name
   - **Expected**: Shows "Discussion is full" error
   - **Expected**: No ability to join

**Success Criteria**: ✅ Full discussions prevent additional joins with clear messaging

---

### 5. Authenticated User Flow

**Objective**: Verify authenticated users can also use invitation links

**Steps**:
1. **Login as Authenticated User**:
   - Sign in using Discord authentication
   - Ensure user is not already participant in target discussion

2. **Use Invitation Link**:
   - Navigate to valid invitation URL
   - **Expected**: Shows invitation details
   - **Expected**: Name field pre-filled with user's name (if available)
   - **Expected**: Can override name or use default

3. **Join Discussion**:
   - Click accept to join
   - **Expected**: Joins as authenticated participant (not anonymous)
   - **Verify**: User appears in participant list with authenticated status

**Success Criteria**: ✅ Authenticated users can use invitation links and maintain authentication

---

### 6. Mobile Responsiveness

**Objective**: Verify invitation page works on mobile devices

**Steps**:
1. **Test Mobile Layout**:
   - Open invitation page on mobile browser or browser dev tools mobile view
   - **Verify**: Page is readable and usable on small screens
   - **Verify**: Buttons are touch-friendly (minimum 44px)
   - **Verify**: Form inputs work with virtual keyboards

2. **Test Touch Interactions**:
   - Tap form fields and buttons
   - **Verify**: All interactions work without requiring precise clicks
   - **Verify**: Error messages are readable on mobile

**Success Criteria**: ✅ Full mobile functionality with good user experience

---

### 7. Network Error Handling

**Objective**: Verify graceful handling of network issues

**Steps**:
1. **Simulate Network Failures**:
   - Use browser dev tools to simulate offline mode
   - Try to join discussion while offline
   - **Expected**: Shows appropriate network error message
   - **Expected**: Retry functionality when connection restored

2. **Test Slow Network**:
   - Simulate slow 3G connection
   - **Verify**: Loading states show during requests
   - **Verify**: Requests complete successfully despite slowness

**Success Criteria**: ✅ Robust error handling for network conditions

---

## Performance Validation

### Loading Time Benchmarks
- **Initial Page Load**: <2s from URL entry to interactive
- **Token Validation**: <500ms for invitation details display
- **Join Action**: <1s from button click to redirect

### Browser Compatibility
- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (iOS and macOS)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

## Automated Test Commands

### Unit Tests
```bash
bun test src/app/invitations/__tests__/
```

### Integration Tests  
```bash
bun test tests/integration/invitation-token-handler.test.ts
```

### E2E Tests
```bash
bunx playwright test tests/e2e/invitation-flow.spec.ts
```

## Rollback Plan

If critical issues are discovered:

1. **Immediate**: Remove `/invitations/[token]` route
2. **Short-term**: Revert to email-only invitations  
3. **Long-term**: Fix issues and redeploy with additional testing

## Success Checklist

- [ ] All 7 test scenarios pass
- [ ] Performance benchmarks met
- [ ] Mobile experience validated
- [ ] Error states provide clear user guidance
- [ ] Integration with existing systems works seamlessly
- [ ] No regressions in existing invitation functionality

---

**Validation Status**: Ready for test execution once implementation is complete