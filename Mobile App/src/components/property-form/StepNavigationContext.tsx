import { createContext, useContext } from 'react';

interface StepNavContextType {
  goToStep: (index: number) => void;
}

export const StepNavContext = createContext<StepNavContextType>({
  goToStep: () => {},
});

export const useStepNav = () => useContext(StepNavContext);