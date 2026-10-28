import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android.config,
      googleMaps: {
        apiKey: process.env.GOOGLE_API_KEY,
      },
    },
  },
  extra: {
    appVesion: config.version,
    buildVersion: config.android.versionCode,
    slug: config.slug,
    name: config.name,
    githubUrl: config.githubUrl,
    documentationUrl: `${config.githubUrl}/blob/dev/docs/gdmn-app-trade-agents/docs/README.md`,
    eas: {
      projectId: "2605f3fc-a54b-45b6-8761-38225d31d91d",
    },
  },
});
