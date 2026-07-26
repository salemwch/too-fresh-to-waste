/**
 * UserAvatar — profile image with an initials fallback.
 *
 * Used by both the podium and the list rows at four different sizes, so the
 * frame is computed from `size` rather than fixed in the StyleSheet.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FastImage from 'react-native-fast-image';

import { IMAGE_PRESETS, getOptimizedImageUrl } from '@/utils/imageTransform';

import { CHAMPION_GOLD, GOLD_10 } from '../../constants/palette';

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: GOLD_10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontWeight: '700',
    color: CHAMPION_GOLD,
  },
});

/** Initials sit at just over a third of the frame at every size. */
const INITIALS_SIZE_RATIO = 0.35;

const RING_WIDTH = 2.5;

export interface UserAvatarProps {
  uri: string | null;
  firstName: string;
  lastName: string;
  size: number;
  /** Adds a ring — the podium uses it to mark champion and medal places. */
  borderColor?: string;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  uri,
  firstName,
  lastName,
  size,
  borderColor,
}) => {
  const frameStyle = { width: size, height: size, borderRadius: size / 2 };
  const ringStyle = borderColor != null ? { borderWidth: RING_WIDTH, borderColor } : undefined;

  if (uri != null) {
    const optimizedUri = getOptimizedImageUrl(uri, IMAGE_PRESETS.avatar) ?? uri;
    return (
      <FastImage
        source={{ uri: optimizedUri, priority: FastImage.priority.normal }}
        style={[frameStyle, ringStyle]}
      />
    );
  }

  const initials = `${firstName[0] ?? '?'}${lastName[0] ?? ''}`.toUpperCase();

  return (
    <View style={[styles.fallback, frameStyle, ringStyle]}>
      <Text style={[styles.initials, { fontSize: size * INITIALS_SIZE_RATIO }]}>{initials}</Text>
    </View>
  );
};
