import fs from 'node:fs';
import path from 'node:path';
import { paths } from './kubectl.js';

export function getHealthData(): Record<string, any> {
  const tfstatePath = path.join(paths.PROJECT_ROOT, 'terraform', 'terraform.tfstate');
  const data: Record<string, any> = {
    state: 'UNKNOWN', name: 'N/A', plan: 'N/A', region: 'N/A', dashboard: 'N/A',
    created_date: null, expiry_msg: null, days_left: null,
    kubeconfig_type: null, kubeconfig_path: null, api_server: null,
    modules: [], modules_configured: [],
  };

  if (!fs.existsSync(tfstatePath)) return data;

  try {
    const state = JSON.parse(fs.readFileSync(tfstatePath, 'utf8'));
    for (const res of state.resources || []) {
      if (res.type === 'btp_subaccount_environment_instance') {
        const attr = res.instances[0].attributes;
        data.state = attr.state || 'UNKNOWN';
        data.name = attr.name || 'N/A';
        data.plan = attr.plan_name || 'N/A';
        data.created_date = attr.created_date;
        data.dashboard = attr.dashboard_url || 'N/A';
        try {
          const labels = JSON.parse(attr.labels || '{}');
          const expiry = labels['Trial account expiration details'] || '';
          if (expiry) { data.expiry_msg = expiry; const m = expiry.match(/(\d+)/); if (m) data.days_left = parseInt(m[1], 10); }
          data.api_server = labels.APIServerURL || null;
        } catch {}
        try {
          const params = JSON.parse(attr.parameters || '{}');
          data.modules = (params.modules?.list || []).map((m: any) => ({ name: m.name || '', channel: m.channel || 'regular' }));
        } catch {}
      }
      if (res.type === 'btp_subaccount') {
        data.region = res.instances[0].attributes.region || 'N/A';
      }
    }
  } catch {}

  // Configured modules from terraform.tfvars
  const tfvarsPath = path.join(paths.PROJECT_ROOT, 'config', 'terraform.tfvars');
  if (fs.existsSync(tfvarsPath)) {
    try {
      const content = fs.readFileSync(tfvarsPath, 'utf8');
      const activeLines = content.split('\n').filter(l => !/^\s*#/.test(l));
      const active = activeLines.join('\n');
      const names = [...active.matchAll(/name\s*=\s*"([^"]+)"/g)].map(m => m[1]);
      const channels = [...active.matchAll(/channel\s*=\s*"([^"]+)"/g)].map(m => m[1]);
      const configured = names.map((n, i) => ({ name: n, channel: channels[i] || 'regular' }));
      if (configured.length) data.modules_configured = configured;
    } catch {}
  }

  // Kubeconfig presence
  if (fs.existsSync(paths.TOKEN_KUBECONFIG)) { data.kubeconfig_type = 'token'; data.kubeconfig_path = paths.TOKEN_KUBECONFIG; }
  else if (fs.existsSync(paths.OIDC_KUBECONFIG)) { data.kubeconfig_type = 'oidc'; data.kubeconfig_path = paths.OIDC_KUBECONFIG; }
  else if (fs.existsSync(paths.OIDC_KUBECONFIG2)) { data.kubeconfig_type = 'oidc'; data.kubeconfig_path = paths.OIDC_KUBECONFIG2; }

  // Cluster age
  if (data.created_date) {
    try { data.age_days = Math.floor((Date.now() - new Date(data.created_date).getTime()) / 86_400_000); } catch { data.age_days = null; }
  }

  // Expiry date
  if (data.days_left != null) {
    try {
      const dt = new Date(Date.now() + data.days_left * 86_400_000);
      data.expiry_date = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      data.expiry_datetime = `${data.expiry_date} \u00b7 ${dt.toISOString().slice(11, 16)} UTC`;
      data.expiry_iso = dt.toISOString();
    } catch { data.expiry_date = data.expiry_datetime = data.expiry_iso = null; }
  } else { data.expiry_date = data.expiry_datetime = data.expiry_iso = null; }

  return data;
}
