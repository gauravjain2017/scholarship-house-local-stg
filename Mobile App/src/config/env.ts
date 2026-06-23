import Constants from 'expo-constants';

type AppEnv = 'development' | 'staging' | 'production';

interface AppConfig {
  appEnv: AppEnv;
  apiUrl: string;
  /** Public web app origin — used to build shareable property links. */
  webUrl: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<AppConfig>;

if (!extra.apiUrl) {
  console.warn('[env] apiUrl missing in expoConfig.extra — check app.config.ts');
}

export const env: AppConfig = {
  appEnv: (extra.appEnv as AppEnv) ?? 'development',
  apiUrl: extra.apiUrl ?? 'http://localhost:3000',
  webUrl: 'https://scholarshiphouses.com/',
};

export const isDev = env.appEnv === 'development';
export const isProd = env.appEnv === 'production';
