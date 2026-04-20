import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore } from '@/store/useAppStore';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

export function NamespaceSelect() {
  const { activeNamespace, setNamespace } = useAppStore();
  const { data } = useQuery({ queryKey: ['namespaces'], queryFn: api.namespaces, staleTime: 60000 });

  const namespaces: string[] = data?.namespaces || data?.items?.map((n: { metadata: { name: string } }) => n.metadata.name) || [];

  return (
    <Select value={activeNamespace} onValueChange={setNamespace}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Namespace" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="-all-">All Namespaces</SelectItem>
        {namespaces.map((ns) => (
          <SelectItem key={ns} value={ns}>
            {ns}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
