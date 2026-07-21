import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const ignoredPath = (url: string): boolean =>
  url.includes('/health') || url.includes('/metrics');

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'pcms-api',
  }),
  traceExporter: new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      'http://localhost:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingRequestHook: (request) =>
          ignoredPath(request.url ?? ''),
        ignoreOutgoingRequestHook: (request) =>
          ignoredPath(request.path ?? ''),
      },
      '@opentelemetry/instrumentation-express': {
        ignoreLayersType: [],
      },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  void sdk.shutdown();
});
