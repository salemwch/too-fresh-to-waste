/**
 * Edit Profile Screen
 * Form for users to edit their profile information
 */

import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';

import { Text, Button, Card, Avatar } from '@/design-system/components/atoms';
import { useTheme } from '@/design-system/providers';
import { useAppSelector } from '@/hooks/redux';

import type { MainStackParamList } from '@/navigation/types';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type EditProfileScreenNavigationProp = NativeStackNavigationProp<MainStackParamList, 'EditProfile'>;

interface EditProfileScreenProps {
  navigation: EditProfileScreenNavigationProp;
}

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  const { user } = useAppSelector(state => state.auth);

  const handleSaveProfile = () => {
    // TODO: Implement profile update logic
    console.log('Save profile');
    navigation.goBack();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Card style={styles.card}>
          <View style={styles.avatarSection}>
            <Avatar
              size='xl'
              initials={
                user?.firstName && user?.lastName ? `${user.firstName[0]}${user.lastName[0]}` : 'U'
              }
              variant='circular'
            />
            <Button variant='text' size='sm' onPress={() => {}} style={{ marginTop: 12 }}>
              Change Photo
            </Button>
          </View>

          <Text variant='headline' size='lg' weight='bold' style={styles.title}>
            Edit Profile
          </Text>

          <View style={styles.placeholder}>
            <Text variant='body' size='md' align='center' color='secondary'>
              ✏️ Profile edit form will be here
            </Text>
            <Text
              variant='body'
              size='sm'
              align='center'
              color='secondary'
              style={{ marginTop: 8 }}
            >
              Fields: Name, Email, Phone, Address, Bio, etc.
            </Text>
          </View>

          <Button variant='primary' size='lg' onPress={handleSaveProfile} style={styles.button}>
            Save Changes
          </Button>

          <Button
            variant='outline'
            size='md'
            onPress={() => navigation.goBack()}
            style={styles.button}
          >
            Cancel
          </Button>
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  card: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    marginBottom: 24,
  },
  placeholder: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  button: {
    marginTop: 12,
  },
});
