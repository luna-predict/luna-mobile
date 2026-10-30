import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface FormattedMessageProps {
  content: string;
  color?: string;
  fontSize?: number;
  selectable?: boolean;
}

/**
 * Parses inline formatting: **bold**, *italic*, `code`.
 */
function renderInlineText(text: string, baseColor: string, baseFontSize: number): React.ReactNode {
  // Split on bold, italic, and inline code patterns
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
      return (
        <Text key={index} style={{ fontWeight: '700', color: baseColor, fontSize: baseFontSize }}>
          {token.slice(2, -2)}
        </Text>
      );
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
      return (
        <Text key={index} style={{ fontStyle: 'italic', color: baseColor, fontSize: baseFontSize }}>
          {token.slice(1, -1)}
        </Text>
      );
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
      return (
        <Text
          key={index}
          style={{
            fontFamily: 'monospace',
            backgroundColor: 'rgba(0,0,0,0.06)',
            color: baseColor,
            fontSize: baseFontSize * 0.9,
          }}
        >
          {token.slice(1, -1)}
        </Text>
      );
    }
    return token;
  });
}

export const FormattedMessage: React.FC<FormattedMessageProps> = ({
  content,
  color = '#1F2937',
  fontSize = 16,
  selectable = true,
}) => {
  const elements = useMemo(() => {
    const lines = content.split('\n');
    const nodes: React.ReactNode[] = [];

    let currentList: { type: 'bullet' | 'numbered'; items: string[] } | null = null;

    const flushList = () => {
      if (!currentList) return;
      const list = currentList;
      currentList = null;
      nodes.push(
        <View key={`list-${nodes.length}`} style={styles.listContainer}>
          {list.items.map((item, idx) => (
            <View key={idx} style={styles.listItem}>
              <Text style={[styles.listBullet, { color, fontSize }]}>
                {list.type === 'bullet' ? '•' : `${idx + 1}.`}
              </Text>
              <Text selectable={selectable} style={[styles.listText, { color, fontSize }]}>
                {renderInlineText(item, color, fontSize)}
              </Text>
            </View>
          ))}
        </View>
      );
    };

    lines.forEach((rawLine, idx) => {
      const line = rawLine.trim();

      if (!line) {
        flushList();
        return;
      }

      // Headers (e.g. #, ##, ###)
      if (line.startsWith('#')) {
        flushList();
        const level = (line.match(/^#+/) || ['#'])[0].length;
        const text = line.replace(/^#+\s*/, '');
        const headerSize = level === 1 ? fontSize * 1.3 : level === 2 ? fontSize * 1.15 : fontSize * 1.05;
        nodes.push(
          <Text
            key={`h-${idx}`}
            selectable={selectable}
            style={[styles.header, { color, fontSize: headerSize, marginTop: nodes.length > 0 ? 8 : 0 }]}
          >
            {renderInlineText(text, color, headerSize)}
          </Text>
        );
        return;
      }

      // Blockquotes (> text)
      if (line.startsWith('>')) {
        flushList();
        const text = line.replace(/^>\s*/, '');
        nodes.push(
          <View key={`quote-${idx}`} style={[styles.blockquote, { borderLeftColor: color }]}>
            <Text selectable={selectable} style={[styles.quoteText, { color, fontSize }]}>
              {renderInlineText(text, color, fontSize)}
            </Text>
          </View>
        );
        return;
      }

      // Bullet lists (- item or * item)
      if (/^[-*]\s+/.test(line)) {
        const text = line.replace(/^[-*]\s+/, '');
        if (currentList && currentList.type === 'bullet') {
          currentList.items.push(text);
        } else {
          flushList();
          currentList = { type: 'bullet', items: [text] };
        }
        return;
      }

      // Numbered lists (1. item)
      if (/^\d+\.\s+/.test(line)) {
        const text = line.replace(/^\d+\.\s+/, '');
        if (currentList && currentList.type === 'numbered') {
          currentList.items.push(text);
        } else {
          flushList();
          currentList = { type: 'numbered', items: [text] };
        }
        return;
      }

      // Normal paragraph
      flushList();
      nodes.push(
        <Text
          key={`p-${idx}`}
          selectable={selectable}
          style={[styles.paragraph, { color, fontSize, marginTop: nodes.length > 0 ? 6 : 0 }]}
        >
          {renderInlineText(line, color, fontSize)}
        </Text>
      );
    });

    flushList();
    return nodes;
  }, [content, color, fontSize, selectable]);

  return <View style={styles.container}>{elements}</View>;
};

const styles = StyleSheet.create({
  container: { width: '100%' },
  header: {
    fontWeight: '800',
    marginBottom: 4,
  },
  paragraph: {
    lineHeight: 23,
  },
  listContainer: {
    marginTop: 4,
    marginBottom: 4,
    gap: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  listBullet: {
    fontWeight: '700',
    minWidth: 16,
  },
  listText: {
    flex: 1,
    lineHeight: 22,
  },
  blockquote: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    marginVertical: 4,
    opacity: 0.9,
  },
  quoteText: {
    fontStyle: 'italic',
    lineHeight: 22,
  },
});

