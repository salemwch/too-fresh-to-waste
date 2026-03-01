/**
 * HowYouEarnGrid
 * 2x2 grid showing ways to earn points.
 * Currently only "Save a Bag" is active — others show "Coming Soon".
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';

import { Card, Icon, Text } from '@/design-system/components/atoms';

interface EarnMethod {
  icon: string;
  label: string;
  points: string;
  color: string;
  bgColor: string;
  active: boolean;
}

const EARN_METHODS: EarnMethod[] = [
  {
    icon: 'bag-handle-outline',
    label: 'Save a Bag',
    points: '+10 pts',
    color: '#10B981',
    bgColor: '#D1FAE5',
    active: true,
  },
  {
    icon: 'chatbubble-ellipses-outline',
    label: 'Write Review',
    points: '+10 pts',
    color: '#6366F1',
    bgColor: '#E0E7FF',
    active: false,
  },
  {
    icon: 'flame-outline',
    label: 'Daily Login',
    points: '+2 pts',
    color: '#F59E0B',
    bgColor: '#FEF3C7',
    active: true,
  },
  {
    icon: 'people-outline',
    label: 'Refer Friend',
    points: '+15 pts',
    color: '#EC4899',
    bgColor: '#FCE7F3',
    active: false,
  },
];

const EarnCard: React.FC<{ method: EarnMethod }> = ({ method }) => (
  <Card variant='elevated' style={[styles.earnCard, !method.active && styles.earnCardInactive]}>
    <View
      style={[styles.iconCircle, { backgroundColor: method.active ? method.bgColor : '#F1F5F9' }]}
    >
      <Icon
        name={method.icon}
        family='Ionicons'
        size={24}
        color={method.active ? method.color : '#94A3B8'}
      />
    </View>
    <Text
      variant='body'
      size='sm'
      weight='semibold'
      style={[styles.earnLabel, !method.active && styles.inactiveText]}
    >
      {method.label}
    </Text>
    <Text
      variant='body'
      size='xs'
      weight='bold'
      style={{ color: method.active ? method.color : '#94A3B8' }}
    >
      {method.active ? method.points : 'Coming Soon'}
    </Text>
  </Card>
);

const HowYouEarnGridComponent: React.FC = () => (
  <View style={styles.container}>
    <Text variant='title' size='md' weight='semibold' style={styles.sectionTitle}>
      How You Earn
    </Text>
    <View style={styles.grid}>
      {EARN_METHODS.map(method => (
        <EarnCard key={method.label} method={method} />
      ))}
    </View>
  </View>
);

export const HowYouEarnGrid = React.memo(HowYouEarnGridComponent);
HowYouEarnGridComponent.displayName = 'HowYouEarnGrid';

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  earnCard: {
    width: '47%',
    padding: 16,
    alignItems: 'center',
    borderRadius: 16,
  },
  earnCardInactive: {
    opacity: 0.6,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  earnLabel: {
    marginBottom: 4,
    textAlign: 'center',
  },
  inactiveText: {
    color: '#94A3B8',
  },
});
