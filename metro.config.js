const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const { assetExts, sourceExts } = config.resolver;
const defaultBlockList = [config.resolver.blockList].flat().filter(Boolean);
const projectPathPattern = __dirname
  .replace(/\\/g, "/")
  .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  .replace(/\//g, "[/\\\\]");

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
};

config.resolver = {
  ...config.resolver,
  // Windows creates a watcher per directory. Skip generated native/web output,
  // while keeping dependency JavaScript (including node_modules/*/build) visible.
  blockList: [
    ...defaultBlockList,
    /[/\\](?:\.git|\.gradle|\.cxx)(?:[/\\]|$)/,
    /[/\\]android[/\\](?:app[/\\])?build(?:[/\\]|$)/,
    /[/\\]node_modules[/\\](?:@[^/\\]+[/\\])?[^/\\]+[/\\](?:android|ios)(?:[/\\]|$)/,
    new RegExp(`^${projectPathPattern}[/\\\\](?:dist|\\.expo[/\\\\]onboarding-preview)(?:[/\\\\]|$)`),
    // Keep local credentials and development-only files out of the JS/asset graph.
    new RegExp(`^${projectPathPattern}[/\\\\](?:credentials|tests|docs|\\.idea|\\.vscode|\\.agents|\\.codex|\\.aws)(?:[/\\\\]|$)`),
    new RegExp(`^${projectPathPattern}[/\\\\]src[/\\\\]api[/\\\\]test(?:[/\\\\]|$)`),
    /[/\\](?:credentials\.json|\.env(?:\.[^/\\]+)?|[^/\\]+\.(?:jks|keystore|p12|p8|mobileprovision))$/,
  ],
  assetExts: assetExts.filter((ext) => ext !== "svg"),
  sourceExts: [...sourceExts, "svg"],
};

module.exports = config;
