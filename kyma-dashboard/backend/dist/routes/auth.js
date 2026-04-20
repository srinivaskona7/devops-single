import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { paths, findBtp } from '../lib/kubectl.js';
const _auth = { authenticated: false, username: null, token: null };
const BTP_CMD = findBtp();
export async function authRoutes(app) {
    // POST /auth/login — authenticate user
    app.post('/auth/login', async (req, reply) => {
        const { username, password } = req.body || {};
        // Simple session-based auth — mark as authenticated
        _auth.authenticated = true;
        _auth.username = username || _readBtpUsername();
        reply.redirect(302, '/dashboard');
        return;
    });
    // GET /auth/status
    app.get('/auth/status', async () => ({
        authenticated: _auth.authenticated,
        username: _auth.username,
    }));
    // GET /auth/login — return portal URL + username hint
    app.get('/auth/login', async () => {
        return {
            portal_url: `https://cockpit.btp.cloud.sap/cockpit/?redirectUrl=http://localhost:${process.env.PORT || 8100}/auth/callback`,
            username_hint: _readBtpUsername(),
        };
    });
    // POST /auth/logout
    app.post('/auth/logout', async () => {
        _auth.authenticated = false;
        _auth.username = null;
        _auth.token = null;
        return { success: true };
    });
    // GET /auth/callback?token=X
    app.get('/auth/callback', async (req, reply) => {
        _auth.authenticated = true;
        _auth.username = _readBtpUsername();
        if (req.query.token)
            _auth.token = req.query.token;
        reply.redirect(302, '/');
        return;
    });
    // POST /api/btp-login-credentials — BTP CLI login with user/pass
    app.post('/api/btp-login-credentials', async (req) => {
        const { user, pass } = req.body;
        if (!user || !pass)
            return { success: false, error: 'Missing user/password' };
        const subdomain = _readSubdomain();
        const args = [BTP_CMD, 'login', '--url', 'https://cli.btp.cloud.sap', '--user', user, '--password', pass];
        if (subdomain)
            args.push('--subdomain', subdomain);
        try {
            execSync(args.join(' '), { timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe'] });
            _auth.authenticated = true;
            _auth.username = user;
            return { success: true };
        }
        catch (e) {
            return { success: false, error: (e.stdout?.toString() || '') + (e.stderr?.toString() || '') };
        }
    });
    // GET /api/btp-login — get SSO login URL
    app.get('/api/btp-login', async () => {
        try {
            const subdomain = _readSubdomain();
            const ssoCmd = [BTP_CMD, 'login', '--url', 'https://cli.btp.cloud.sap', '--sso', 'manual'];
            if (subdomain)
                ssoCmd.push('--subdomain', subdomain);
            let output = '';
            try {
                const res = execSync(ssoCmd.join(' '), { timeout: 3_000, stdio: ['pipe', 'pipe', 'pipe'] });
                output = res.toString();
            }
            catch (e) {
                output = (e.stdout?.toString() || '') + (e.stderr?.toString() || '');
            }
            // Clean interactive prompt lines
            const cleanOutput = output.split('\n')
                .filter(l => !l.includes('CLI server URL') && !l.includes('Server Certificate'))
                .join('\n');
            // Match URL with path segment
            const urlMatch = cleanOutput.match(/(https:\/\/[^\s\]>"<)]+\/[^\s\]>"<)]+)/);
            if (urlMatch)
                return { url: urlMatch[1] };
            if (output.toLowerCase().includes('already logged in'))
                return { authenticated: true, message: 'Already logged in.' };
            return {
                error: 'Could not extract SSO URL. BTP CLI may already be authenticated or the session is busy.',
                output, subdomain_used: subdomain || '(none)',
            };
        }
        catch (e) {
            return { error: e.message };
        }
    });
}
function _readBtpUsername() {
    const tfvarsPath = path.join(paths.PROJECT_ROOT, 'config', 'terraform.tfvars');
    if (!fs.existsSync(tfvarsPath))
        return '';
    try {
        const content = fs.readFileSync(tfvarsPath, 'utf8');
        const m = content.match(/btp_username\s*=\s*"([^"]*)"/);
        return m ? m[1] : '';
    }
    catch {
        return '';
    }
}
function _readSubdomain() {
    const tfvarsPath = path.join(paths.PROJECT_ROOT, 'config', 'terraform.tfvars');
    if (!fs.existsSync(tfvarsPath))
        return null;
    try {
        const content = fs.readFileSync(tfvarsPath, 'utf8');
        const m = content.match(/globalaccount\s*=\s*"([^"]+)"/);
        return m ? m[1] : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=auth.js.map