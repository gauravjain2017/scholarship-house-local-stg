import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Controller, useFormContext } from 'react-hook-form';
import { Input } from '@/components/Input';
import { Select } from '@/components/Select';
import { Row } from '@/components/Row';
import type { PropertyFormInput } from '@/utils/propertyFormSchema';
import { US_STATE_OPTIONS } from '@/utils/usStates';

export function Step2Location() {
  const { control, formState: { errors } } = useFormContext<PropertyFormInput>();

  return (
    <View>
      <Controller
        control={control}
        name="streetAddress"
        render={({ field }) => (
          <Input
            label="Street address *"
            value={field.value}
            onChangeText={field.onChange}
            placeholder="123 Main St"
            error={errors.streetAddress?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="addressLine2"
        render={({ field }) => (
          <Input
            label="Address line 2 (optional)"
            value={field.value}
            onChangeText={field.onChange}
            placeholder="Apt, Suite, Unit, etc."
            error={errors.addressLine2?.message}
          />
        )}
      />

      <Row>
        <Controller
          control={control}
          name="city"
          render={({ field }) => (
            <Input
              label="City *"
              value={field.value}
              onChangeText={field.onChange}
              error={errors.city?.message}
            />
          )}
        />
		
		     <Controller
        control={control}
        name="stateRegion"
        render={({ field }) => (
          <Select
            label="State *"
            placeholder="Select a state"
            value={field.value}
            options={US_STATE_OPTIONS}
            onChange={field.onChange}
            error={errors.stateRegion?.message}
          />
        )}
      />
		
       
      </Row>

    <Controller
          control={control}
          name="postalCode"
          render={({ field }) => (
            <Input
              label="Postal/Zip Code *"
              value={field.value}
              onChangeText={field.onChange}
              keyboardType="numeric"
              error={errors.postalCode?.message}
            />
          )}
        />
    </View>
  );
}

const styles = StyleSheet.create({});
