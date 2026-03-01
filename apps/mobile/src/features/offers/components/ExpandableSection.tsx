/**
 * ExpandableSection Component
 * Collapsible section for additional offer information
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';

import { Text, Icon } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ExpandableSectionProps {
  /** Section title */
  title: string;
  /** Section content */
  children: React.ReactNode;
  /** Default expanded state */
  defaultExpanded?: boolean;
  /** Variant style */
  variant?: 'default' | 'link';
  /** Test ID */
  testID?: string;
}

export const ExpandableSection: React.FC<ExpandableSectionProps> = ({
  title,
  children,
  defaultExpanded = false,
  variant = 'default',
  testID = 'expandable-section',
}) => {
  const theme = useTheme();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsExpanded(!isExpanded);
  };

  if (variant === 'link') {
    return (
      <Pressable
        style={[styles.linkButton, { borderTopColor: theme.colors.outline }]}
        onPress={handleToggle}
        testID={testID}
        accessibilityRole='button'
        accessibilityState={{ expanded: isExpanded }}
      >
        <Text variant='body' size='md' weight='medium' color='primary' style={styles.linkText}>
          {title}
        </Text>
        <Icon
          name='chevron-right'
          size={20}
          color={theme.colors.onSurfaceVariant}
          style={[styles.icon, isExpanded && styles.iconRotated]}
        />
      </Pressable>
    );
  }

  return (
    <View style={[styles.container, { borderTopColor: theme.colors.outline }]} testID={testID}>
      {/* Header */}
      <Pressable
        style={styles.header}
        onPress={handleToggle}
        accessibilityRole='button'
        accessibilityState={{ expanded: isExpanded }}
        accessibilityLabel={title}
        accessibilityHint={isExpanded ? 'Tap to collapse' : 'Tap to expand'}
      >
        <Text variant='body' size='md' weight='semibold'>
          {title}
        </Text>
        <Icon
          name='chevron-down'
          size={20}
          color={theme.colors.onSurfaceVariant}
          style={[styles.icon, isExpanded && styles.iconRotated]}
        />
      </Pressable>

      {/* Content */}
      {isExpanded && <View style={styles.content}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  icon: {
    flexShrink: 0,
  },
  iconRotated: {
    transform: [{ rotate: '180deg' }],
  },
});
