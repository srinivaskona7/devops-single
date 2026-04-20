import { useParams } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';

/**
 * Returns the active namespace from EITHER:
 * 1. URL path param: /namespaces/:namespace/pods
 * 2. Query param: /pods?namespace=kyma-system
 */
export function useNamespace(): string {
  const params = useParams<{ namespace?: string }>();
  const [searchParams] = useSearchParams();
  return params.namespace || searchParams.get('namespace') || '';
}
