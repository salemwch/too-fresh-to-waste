import React, { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import { Text, Icon } from '@/design-system/components/atoms';

import { useDonationStats } from '../hooks/useDonations';

const WHITE = '#FFFFFF';
const WHITE_70 = 'rgba(255,255,255,0.7)';

interface DonationImpactCardProps {
  onPress: () => void;
}

const DonationImpactCardComponent: React.FC<DonationImpactCardProps> = ({ onPress }) => {
  const { t } = useTranslation();
  const { data: stats } = useDonationStats();

  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: 'rgba(232, 117, 106, 0.08)', borderless: false }}
      style={({ pressed }) => [Platform.OS === 'ios' && pressed && { opacity: 0.85 }]}
      accessibilityRole='button'
      accessibilityLabel={t('navigation.communityImpact')}
      accessibilityHint={t('donations.seeHowWeHelp')}
    >
      <LinearGradient
        colors={['#E8756A', '#D4547A', '#B8488E']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.label}>{t('profile.community')}</Text>
          <Text style={styles.title}>{t('donations.mercyImpact')}</Text>
          <Text style={styles.sub}>
            {stats
              ? t('donations.heartsJoined', { count: stats.contributorCount })
              : t('donations.seeHowWeHelp')}
          </Text>
        </View>
        <View style={styles.cardRight}>
          <Icon name='heart' family='Ionicons' size={36} color='rgba(255,255,255,0.4)' />
          <Icon
            name='chevron-forward'
            family='Ionicons'
            size={20}
            color={WHITE_70}
            style={styles.chevron}
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#D4547A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  cardLeft: {
    flex: 1,
  },
  label: {
    fontSize: 11,
    color: WHITE_70,
    fontWeight: '500',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: WHITE,
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    color: 'rgba(255,220,220,0.85)',
  },
  cardRight: {
    alignItems: 'center',
  },
  chevron: {
    marginTop: 12,
  },
});

DonationImpactCardComponent.displayName = 'DonationImpactCard';
export const DonationImpactCard = memo(DonationImpactCardComponent);
