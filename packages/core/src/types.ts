export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface OnboardingTour {
  id: string;
  name: string;
  steps: OnboardingStep[];
  isActive: boolean;
}

export interface OnboardingStep {
  id: string;
  targetSelector: string;
  title: string;
  content: string;
  position: "top" | "bottom" | "left" | "right";
}
