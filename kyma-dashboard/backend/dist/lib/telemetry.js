import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
let sdk = null;
export function initTelemetry() {
    try {
        const prometheusExporter = new PrometheusExporter({ port: 9464 });
        const traceExporter = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
            ? new OTLPTraceExporter({ url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT })
            : undefined;
        sdk = new NodeSDK({
            resource: new Resource({
                [ATTR_SERVICE_NAME]: 'btp-kyma-manager',
                [ATTR_SERVICE_VERSION]: '1.0.0',
            }),
            metricReader: prometheusExporter,
            traceExporter,
        });
        sdk.start();
        console.log('OpenTelemetry initialized — Prometheus on :9464/metrics');
    }
    catch (e) {
        console.warn('OpenTelemetry init failed (non-fatal):', e);
    }
}
export async function shutdownTelemetry() {
    if (sdk)
        await sdk.shutdown();
}
//# sourceMappingURL=telemetry.js.map