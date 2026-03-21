export interface ThemeTokens {
  background: string;
  foreground: string;
  card: string;
  "card-foreground": string;
  popover: string;
  "popover-foreground": string;
  primary: string;
  "primary-foreground": string;
  secondary: string;
  "secondary-foreground": string;
  muted: string;
  "muted-foreground": string;
  accent: string;
  "accent-foreground": string;
  destructive: string;
  "destructive-foreground": string;
  border: string;
  input: string;
  ring: string;
  success: string;
  warning: string;
  "tabular-frame-border-color": string;
  "tabular-header-bg": string;
  "tabular-header-text": string;
  "tabular-grid-line-color": string;
  "tabular-row-hover-bg": string;
  "tabular-selection-bg": string;
}

export type ThemeTokenKey = keyof ThemeTokens;

export interface ThemeDefinition {
  id: string;
  label: string;
  tokens: ThemeTokens;
}
