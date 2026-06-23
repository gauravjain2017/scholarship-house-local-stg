import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Legacy entry point — the property-creation wizard moved to `/(tabs)/submit`
 * so it behaves like a real tab (no modal feel, no stacking, works in
 * release builds). Anything that still links to `/properties/new`
 * (deep links, profile shortcuts, older callers) lands here and is
 * forwarded to the tab while preserving the `?resumeDraftId=...` query.
 */
export default function NewPropertyRedirect() {
  const { resumeDraftId } = useLocalSearchParams<{ resumeDraftId?: string }>();
  return (
    <Redirect
      href={
        resumeDraftId
          ? { pathname: '/(tabs)/submit', params: { resumeDraftId } }
          : '/(tabs)/submit'
      }
    />
  );
}
