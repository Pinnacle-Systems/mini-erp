import { registerPlugin } from "@capacitor/core";

export type AppHttpRequest = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  bodyText?: string;
  dnsHost?: string;
};

export type AppHttpResponse = {
  status: number;
  headers: Record<string, string>;
  bodyText: string;
  bodyBase64?: string | null;
};

type AppHttpPlugin = {
  execute(options: AppHttpRequest): Promise<AppHttpResponse>;
};

export const AppHttp = registerPlugin<AppHttpPlugin>("AppHttp");
