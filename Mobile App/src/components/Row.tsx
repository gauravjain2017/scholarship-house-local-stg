import React from 'react';
import { View } from 'react-native';
import { spacing } from '@/theme';

/**
 * Two-column layout helper. Each direct child is given equal flex,
 * so an Input on each side gets half the row width.
 *
 *   <Row>
 *     <Controller ... />
 *     <Controller ... />
 *   </Row>
 */
export function Row({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {React.Children.map(children, (child) => (
        <View style={{ flex: 1 }}>{child}</View>
      ))}
    </View>
  );
}
