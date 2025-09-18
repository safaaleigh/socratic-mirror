# Chat UI Implementation Plan

## Overview
Implement a modern, responsive chat interface using Vercel AI SDK's `useChat` hook with shadcn/ui components for a seamless desktop and mobile experience.

## Core Requirements
- **AI SDK Integration**: Use `useChat` hook for streaming chat functionality
- **Responsive Design**: Mobile-first approach with desktop enhancements
- **Component Library**: shadcn/ui for consistent, accessible components
- **Real-time Updates**: WebSocket integration for multi-participant awareness
- **Performance**: Optimized for smooth scrolling and fast message delivery

## Technical Stack
- **Frontend**: Next.js 15, React, TypeScript
- **UI Components**: shadcn/ui (Card, Button, Input, ScrollArea, Avatar)
- **Chat Engine**: Vercel AI SDK's useChat hook
- **Styling**: Tailwind CSS v4
- **State Management**: React hooks + AI SDK built-in state

## Implementation Phases

### Phase 1: Backend Enhancement (Day 1)
1. **Update Chat API** (`/api/discussion/[id]/chat/route.ts`)
   - Implement proper AI SDK streaming protocol
   - Add message metadata support
   - Enhance error handling for better UX
   - Support both authenticated users and anonymous participants

2. **Message Format**
   - Adopt AI SDK's UIMessage format with parts array
   - Include metadata for participant info, timestamps
   - Maintain backward compatibility with existing WebSocket

### Phase 2: Core Chat Components (Day 2-3)

#### 2.1 Chat Container (`ChatContainer.tsx`)
- Full-height container with flex layout
- Message list area with virtual scrolling
- Input area with sticky positioning
- Mobile: Full screen | Desktop: Constrained width

#### 2.2 Message List (`MessageList.tsx`)
- ScrollArea component from shadcn
- Auto-scroll to bottom on new messages
- Load more on scroll top (pagination)
- Smooth scrolling animations

#### 2.3 Message Item (`MessageItem.tsx`)
- Avatar + Name + Timestamp header
- Message bubble with proper alignment
- Support for text parts (expandable to support files later)
- Mobile: Compact layout | Desktop: Spacious layout

#### 2.4 Chat Input (`ChatInput.tsx`)
- Auto-resizing textarea
- Character counter (2000 limit)
- Send button with loading state
- Mobile: Above keyboard | Desktop: Bottom of container

### Phase 3: AI SDK Integration (Day 4)

#### 3.1 Custom Transport
```typescript
const transport = new DefaultChatTransport({
  api: `/api/discussion/${discussionId}/chat`,
  prepareSendMessagesRequest: ({ messages }) => ({
    body: {
      messages,
      participantId,
      discussionId,
      sessionId,
    },
  }),
});
```

#### 3.2 useChat Hook Setup
```typescript
const {
  messages,
  sendMessage,
  status,
  error,
  setMessages,
  stop,
} = useChat({
  transport,
  experimental_throttle: 50,
  onFinish: handleMessageComplete,
  onError: handleError,
});
```

### Phase 4: Mobile Optimizations (Day 5)

#### 4.1 Touch Interactions
- Tap to dismiss keyboard
- Pull to refresh history
- Smooth momentum scrolling

#### 4.2 Responsive Layouts
- Dynamic viewport height (100dvh)
- Safe area insets for notches
- Keyboard-aware positioning

#### 4.3 Performance
- Message virtualization for long chats
- Throttled render updates
- Optimistic UI updates

### Phase 5: Polish & Testing (Day 6-7)

#### 5.1 Error Handling
- Connection loss recovery
- Message retry mechanism
- User-friendly error messages

#### 5.2 Loading States
- Skeleton screens for initial load
- Typing indicators
- Message sending feedback

#### 5.3 Accessibility
- ARIA labels and roles
- Keyboard navigation
- Screen reader support

## Component Structure

```
src/components/chat/
├── ChatContainer.tsx       # Main container with layout
├── MessageList.tsx        # Scrollable message area
├── MessageItem.tsx        # Individual message display
├── ChatInput.tsx          # Input with send functionality
├── TypingIndicator.tsx    # Show when others are typing
├── LoadingMessage.tsx     # Skeleton for loading states
└── hooks/
    └── useEnhancedChat.ts # Custom hook wrapping useChat
```

## shadcn Components to Use

1. **Card** - Message bubbles and container
2. **ScrollArea** - Message list with custom scrollbar
3. **Button** - Send button and actions
4. **Avatar** - User/participant avatars
5. **Textarea** - Auto-resizing input (custom)
6. **Alert** - Error messages
7. **Skeleton** - Loading states
8. **Separator** - Date dividers

## Key Features

### Essential
- [x] Real-time message streaming
- [x] Multi-participant support
- [x] Mobile responsive design
- [x] Message persistence
- [x] Error recovery
- [x] Typing indicators
- [x] Auto-scroll behavior
- [x] Character limits

### Nice to Have (Future)
- [ ] File attachments
- [ ] Message search
- [ ] Emoji picker
- [ ] Message editing
- [ ] Read receipts

## Success Metrics
- Message delivery < 200ms
- Smooth scrolling at 60fps
- Mobile Lighthouse score > 90
- Zero message loss
- < 3% error rate

## Testing Plan
1. Unit tests for hooks and utilities
2. Component tests with React Testing Library
3. E2E tests for critical flows
4. Mobile device testing (iOS Safari, Chrome)
5. Performance profiling

## Timeline
- **Day 1**: Backend enhancements
- **Day 2-3**: Core components
- **Day 4**: AI SDK integration
- **Day 5**: Mobile optimizations
- **Day 6-7**: Polish and testing
- **Total**: 1 week to production-ready