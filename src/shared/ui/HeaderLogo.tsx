import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export function HeaderLogo() {
  const { t } = useTranslation();
  return (
    <View style={styles.root} accessibilityLabel={t('app.name')}>
      <Image source={require('../../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 2,
  },
  logo: {
    width: 54,
    height: 54,
  },
});
