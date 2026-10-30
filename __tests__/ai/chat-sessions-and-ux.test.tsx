import React from 'react';
import { render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Store } from '../../src/storage/Store';
import { FormattedMessage } from '../../src/ui/FormattedMessage';
import { ChatSession } from '../../src/types';
import { pauseSpeaking, resumeSpeaking, stopSpeaking } from '../../src/ai/voice/speak';

describe('Chat Sessions, Markdown Formatting, and Voice Controls', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  describe('Multi-session chat storage', () => {
    test('creates, saves, retrieves, and deletes chat sessions', async () => {
      const session1: ChatSession = {
        id: 's1',
        title: 'Cramps question',
        createdAt: '2026-10-30T01:00:00Z',
        updatedAt: '2026-10-30T01:05:00Z',
        mode: 'period',
        language: 'en',
        messages: [
          { role: 'user', content: 'What helps with cramps?' },
          { role: 'assistant', content: 'Magnesium and warm baths help.' },
        ],
      };

      const session2: ChatSession = {
        id: 's2',
        title: 'Fertility timing',
        createdAt: '2026-10-30T02:00:00Z',
        updatedAt: '2026-10-30T02:10:00Z',
        mode: 'conceive',
        language: 'en',
        messages: [
          { role: 'user', content: 'When is ovulation?' },
        ],
      };

      // Save sessions
      await Store.saveChatSession(session1);
      await Store.saveChatSession(session2);

      const all = await Store.getChatSessions();
      expect(all.length).toBe(2);
      // Sorted by updatedAt descending
      expect(all[0].id).toBe('s2');
      expect(all[1].id).toBe('s1');

      // Delete session 1
      const remaining = await Store.deleteChatSession('s1');
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe('s2');
    });

    test('backward compatibility with legacy chat history', async () => {
      // Legacy storage seeded only with luna:chatHistory
      await AsyncStorage.setItem('luna:chatHistory', JSON.stringify([
        { role: 'user', content: 'Why am I fatigued?' },
        { role: 'assistant', content: 'Progesterone rises during the luteal phase.' },
      ]));

      const sessions = await Store.getChatSessions();
      expect(sessions.length).toBe(1);
      expect(sessions[0].title).toContain('Why am I fatigued?');
      expect(sessions[0].messages.length).toBe(2);
    });
  });

  describe('Markdown FormattedMessage component', () => {
    test('renders headers, bold inline, and bullet lists', async () => {
      const markdown = `
### Relieving Period Cramps
Here are some tips:
- **Heat therapy**: Apply a heating pad to your lower abdomen.
- **Hydration**: Drink plenty of water.
1. Rest well
2. Avoid caffeine
> Remember to seek care if pain is severe.
      `.trim();

      await render(<FormattedMessage content={markdown} />);
      expect(screen.getByText('Relieving Period Cramps')).toBeTruthy();
      expect(screen.getByText('Heat therapy')).toBeTruthy();
      expect(screen.getByText('Remember to seek care if pain is severe.')).toBeTruthy();
    });
  });

  describe('Voice output control functions', () => {
    test('pause, resume, and stop speaking run without error', async () => {
      await expect(pauseSpeaking()).resolves.toBeUndefined();
      await expect(resumeSpeaking()).resolves.toBeUndefined();
      await expect(stopSpeaking()).resolves.toBeUndefined();
    });
  });
});
