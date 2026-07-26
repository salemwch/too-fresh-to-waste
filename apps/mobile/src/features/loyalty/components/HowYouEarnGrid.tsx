/**
 * HowYouEarnGrid
 * 2x2 grid showing ways to earn points.
 * "Save a Bag" and "Refer Friend" are active; others show "Coming Soon".
 */

import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Pressable } from 'react-native';

import { Card, Icon, Text } from '@/design-system/components/atoms';
import { colorTokens } from '@/design-system/tokens/colors';

interface EarnMethod {
  icon: string;
  labelKey: string;
  points: string;
  color: string;
  bgColor: string;
  active: boolean;
  key: string;
}

const EARN_METHODS: EarnMethod[] = [
  {
    key: 'save-bag',
    icon: 'bag-handle-outline',
    labelKey: 'loyalty.earnSaveBag',
    points: '+10 pts',
    color: colorTokens.base.success[500],
    bgColor: '#D1FAE5',
    active: true,
  },
  {
    key: 'review',
    icon: 'chatbubble-ellipses-outline',
    labelKey: 'loyalty.earnWriteReview',
    points: '+10 pts',
    color: '#6366F1',
    bgColor: '#E0E7FF',
    active: false,
  },
  {
    key: 'login',
    icon: 'flame-outline',
    labelKey: 'loyalty.earnDailyLogin',
    points: '+2 pts',
    color: colorTokens.base.warning[500],
    bgColor: '#FEF3C7',
    active: true,
  },
  {
    key: 'refer',
    icon: 'people-outline',
    labelKey: 'loyalty.earnReferFriend',
    points: '+50 pts',
    color: '#EC4899',
    bgColor: '#FCE7F3',
    active: true,
  },
];

const INACTIVE_BACKGROUND = '#F1F5F9';
const INACTIVE_TEXT = '#94A3B8';

interface HowYouEarnGridProps {
  onReferPress?: () => void;
}

const EarnCard: React.FC<{ method: EarnMethod; onPress?: () => void }> = ({ method, onPress }) => {
  const { t } = useTranslation();
  const iconCircleStyle = {
    backgroundColor: method.active ? method.bgColor : INACTIVE_BACKGROUND,
  };
  const pointsStyle = {
    color: method.active ? method.color : INACTIVE_TEXT,
  };

  const card = (
    <Card variant='elevated' style={[styles.earnCard, !method.active && styles.earnCardInactive]}>
      <View style={[styles.iconCircle, iconCircleStyle]}>
        <Icon
          name={method.icon}
          family='Ionicons'
          size={24}
          color={method.active ? method.color : INACTIVE_TEXT}
        />
      </View>
      <Text
        variant='body'
        size='sm'
        weight='semibold'
        style={[styles.earnLabel, !method.active && styles.inactiveText]}
      >
        {t(method.labelKey)}
      </Text>
      <Text variant='body' size='xs' weight='bold' style={pointsStyle}>
        {method.active ? method.points : t('common.comingSoon')}
      </Text>
    </Card>
  );

  if (onPress) {
    return (
      <Pressable
        style={styles.cardWrapper}
        onPress={onPress}
        accessibilityRole='button'
        accessibilityLabel={t(method.labelKey)}
        accessibilityHint={t('loyalty.a11yEarnPointsHint')}
      >
        {card}
      </Pressable>
    );
  }
  return <View style={styles.cardWrapper}>{card}</View>;
};

const HowYouEarnGridComponent: React.FC<HowYouEarnGridProps> = ({ onReferPress }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text variant='title' size='md' weight='semibold' style={styles.sectionTitle}>
        {t('loyalty.howYouEarn')}
      </Text>
      <View style={styles.grid}>
        {EARN_METHODS.map(method => (
          <EarnCard
            key={method.key}
            method={method}
            {...(method.key === 'refer' && onReferPress ? { onPress: onReferPress } : {})}
          />
        ))}
      </View>
    </View>
  );
};

export const HowYouEarnGrid = memo(HowYouEarnGridComponent);
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
  cardWrapper: {
    width: '47%',
  },
  earnCard: {
    width: '100%',
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
    color: INACTIVE_TEXT,
  },
});
