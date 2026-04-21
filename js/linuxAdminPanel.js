class LinuxAdminPanel {
  constructor(connection) {
    this.connection = connection;
    this._refreshTimer = null;
    this.activeSection = 'overview';
  }

  init() {
    document.getElementById('admin-refresh')?.addEventListener('click', () => this.refresh());
  }

  async refresh() {
    const c = document.getElementById('admin-content');
    c.innerHTML = this._renderNav() + '<div id="admin-section-content"><div class="devops-status">Loading...</div></div>';
    this._bindNav();
    await this._loadSection(this.activeSection);
  }

  _renderNav() {
    const sections = [
      { id: 'overview', icon: '📊', label: 'Overview' },
      { id: 'cpu', icon: '🖥️', label: 'CPU & Hardware' },
      { id: 'memory', icon: '🧠', label: 'Memory & Swap' },
      { id: 'disk', icon: '💾', label: 'Disk & I/O' },
      { id: 'network', icon: '🌐', label: 'Network' },
      { id: 'connections', icon: '🔌', label: 'Connections' },
      { id: 'processes', icon: '⚙️', label: 'Processes' },
      { id: 'services', icon: '🔧', label: 'Services' },
      { id: 'users', icon: '👥', label: 'Users & Groups' },
      { id: 'security', icon: '🔒', label: 'Security Audit' },
      { id: 'ssh', icon: '🔑', label: 'SSH Keys' },
      { id: 'firewall', icon: '🛡️', label: 'Firewall' },
      { id: 'packages', icon: '📦', label: 'Packages' },
      { id: 'logs', icon: '📋', label: 'System Logs' },
      { id: 'cron', icon: '⏰', label: 'Cron & Timers' },
      { id: 'dns', icon: '🏷️', label: 'DNS & Hosts' },
      { id: 'kernel', icon: '🧬', label: 'Kernel & Sysctl' },
      { id: 'storage', icon: '📁', label: 'Mounts & LVM' },
      { id: 'limits', icon: '📏', label: 'Limits & Tuning' },
      { id: 'boot', icon: '🚀', label: 'Boot & Startup' },
      { id: 'env', icon: '🌍', label: 'Environment' },
      { id: 'permissions', icon: '🔐', label: 'Permissions' },
      { id: 'namespaces', icon: '📦', label: 'Namespaces' },
      { id: 'cgroups', icon: '⚖️', label: 'Cgroups' },
      { id: 'capabilities', icon: '🎫', label: 'Capabilities' },
      { id: 'seccomp', icon: '🔏', label: 'Seccomp & AppArmor' },
      { id: 'procfs', icon: '🗂️', label: '/proc Deep Dive' },
      { id: 'sysfs', icon: '🔬', label: '/sys & Devices' },
      { id: 'signals', icon: '📡', label: 'Signals & IPC' },
      { id: 'fds', icon: '📎', label: 'File Descriptors' },
      { id: 'netns', icon: '🕸️', label: 'Network Namespaces' },
      { id: 'iptables', icon: '🔥', label: 'iptables Deep Dive' },
      { id: 'tcpstack', icon: '📶', label: 'TCP/IP Stack' },
      { id: 'scheduler', icon: '🎯', label: 'CPU Scheduler' },
      { id: 'vmm', icon: '🧊', label: 'Virtual Memory' },
      { id: 'ebpf', icon: '🐝', label: 'eBPF & Tracing' },
      { id: 'containers', icon: '🐳', label: 'Container Internals' },
      { id: 'selinux', icon: '🏛️', label: 'SELinux & MAC' },
      { id: 'kernelarch', icon: '🏗️', label: 'Kernel Architecture' },
    ];
    let html = '<div class="admin-nav">';
    sections.forEach(s => {
      const active = s.id === this.activeSection ? ' active' : '';
      html += `<button class="admin-nav-btn${active}" data-section="${s.id}">${s.icon} ${s.label}</button>`;
    });
    html += '</div>';
    return html;
  }

  _bindNav() {
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeSection = btn.dataset.section;
        this._loadSection(btn.dataset.section);
      });
    });
  }

  async _loadSection(section) {
    const target = document.getElementById('admin-section-content');
    target.innerHTML = '<div class="devops-status">Loading...</div>';
    try {
      const html = await this['_section_' + section]();
      target.innerHTML = html;
      this._bindSectionEvents(section);
    } catch (err) {
      target.innerHTML = `<div class="devops-status error">${this._esc(err.message)}</div>`;
    }
  }

  async _section_overview() {
    const [load, uptime, hostname, kernel, cpuCount, memTotal] = await Promise.all([
      this.connection.exec('cat /proc/loadavg 2>/dev/null'),
      this.connection.exec('uptime -p 2>/dev/null || uptime'),
      this.connection.exec('hostname'),
      this.connection.exec('uname -r'),
      this.connection.exec('nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null'),
      this.connection.exec("free -h 2>/dev/null | awk '/^Mem/{print $2}'"),
    ]);
    const la = load.stdout.trim().split(' ');
    return `
      <div class="admin-grid">
        <div class="admin-stat"><div class="admin-stat-label">Hostname</div><div class="admin-stat-value">${this._esc(hostname.stdout.trim())}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Kernel</div><div class="admin-stat-value">${this._esc(kernel.stdout.trim())}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">CPUs</div><div class="admin-stat-value">${this._esc(cpuCount.stdout.trim())}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">RAM</div><div class="admin-stat-value">${this._esc(memTotal.stdout.trim())}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Load (1/5/15)</div><div class="admin-stat-value">${la.slice(0,3).join(' / ')}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Uptime</div><div class="admin-stat-value">${this._esc(uptime.stdout.trim().replace('up ',''))}</div></div>
      </div>
      <div class="admin-learn">💡 <code>cat /proc/loadavg</code> — Load average shows CPU demand over 1, 5, 15 minutes. If > number of CPUs, system is overloaded.</div>`;
  }

  async _section_cpu() {
    const [info, arch, virt] = await Promise.all([
      this.connection.exec('lscpu 2>/dev/null | head -20 || sysctl -a 2>/dev/null | grep cpu | head -15'),
      this.connection.exec('uname -m'),
      this.connection.exec('systemd-detect-virt 2>/dev/null || echo "bare-metal"'),
    ]);
    return `<pre class="admin-pre">${this._esc(info.stdout.trim())}</pre>
      <div class="admin-grid">
        <div class="admin-stat"><div class="admin-stat-label">Architecture</div><div class="admin-stat-value">${this._esc(arch.stdout.trim())}</div></div>
        <div class="admin-stat"><div class="admin-stat-label">Virtualization</div><div class="admin-stat-value">${this._esc(virt.stdout.trim())}</div></div>
      </div>
      <div class="admin-learn">💡 <code>lscpu</code> — Shows CPU architecture, cores, threads, cache sizes, virtualization type. Essential for capacity planning.</div>`;
  }

  async _section_memory() {
    const [free, swap, top] = await Promise.all([
      this.connection.exec('free -h 2>/dev/null'),
      this.connection.exec('swapon --show 2>/dev/null || echo "No swap"'),
      this.connection.exec('ps aux --sort=-%mem 2>/dev/null | head -6'),
    ]);
    return `<pre class="admin-pre">${this._esc(free.stdout.trim())}</pre>
      <div class="git-section-title">Swap</div><pre class="admin-pre">${this._esc(swap.stdout.trim())}</pre>
      <div class="git-section-title">Top Memory Consumers</div><pre class="admin-pre">${this._esc(top.stdout.trim())}</pre>
      <div class="devops-card-actions"><button class="devops-install-btn secondary" id="admin-drop-cache">Drop Caches (safe)</button>
      <button class="devops-install-btn secondary" id="admin-create-swap">Create 1G Swap</button></div>
      <div class="admin-learn">💡 <code>free -h</code> — Shows RAM usage. "available" is what matters, not "free". Linux uses unused RAM for disk cache. <code>echo 3 > /proc/sys/vm/drop_caches</code> safely frees cached memory.</div>`;
  }

  async _section_disk() {
    const [df, iostat, biggest] = await Promise.all([
      this.connection.exec('df -hT 2>/dev/null | grep -v tmpfs | grep -v devtmpfs'),
      this.connection.exec('iostat -x 1 1 2>/dev/null | tail -10 || cat /proc/diskstats 2>/dev/null | head -5'),
      this.connection.exec('du -sh /* 2>/dev/null | sort -rh | head -10'),
    ]);
    return `<div class="git-section-title">Filesystems</div><pre class="admin-pre">${this._esc(df.stdout.trim())}</pre>
      <div class="git-section-title">I/O Stats</div><pre class="admin-pre">${this._esc(iostat.stdout.trim())}</pre>
      <div class="git-section-title">Largest Directories</div><pre class="admin-pre">${this._esc(biggest.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>df -hT</code> — Disk free with filesystem type. <code>iostat -x</code> shows read/write IOPS and latency per device. <code>%util</code> near 100% = disk bottleneck.</div>`;
  }

  async _section_network() {
    const [ifaces, routes, dns] = await Promise.all([
      this.connection.exec('ip -br addr 2>/dev/null || ifconfig 2>/dev/null | grep -A1 "^[a-z]"'),
      this.connection.exec('ip route 2>/dev/null | head -10 || netstat -rn 2>/dev/null | head -10'),
      this.connection.exec('cat /etc/resolv.conf 2>/dev/null | grep -v "^#"'),
    ]);
    return `<div class="git-section-title">Interfaces</div><pre class="admin-pre">${this._esc(ifaces.stdout.trim())}</pre>
      <div class="git-section-title">Routes</div><pre class="admin-pre">${this._esc(routes.stdout.trim())}</pre>
      <div class="git-section-title">DNS</div><pre class="admin-pre">${this._esc(dns.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>ip -br addr</code> — Brief interface list. <code>ip route</code> shows routing table. Default gateway is where unknown traffic goes.</div>`;
  }

  async _section_connections() {
    const [listen, established, states] = await Promise.all([
      this.connection.exec('ss -tlnp 2>/dev/null | head -20 || netstat -tlnp 2>/dev/null | head -20'),
      this.connection.exec('ss -tn state established 2>/dev/null | head -15 || netstat -tn 2>/dev/null | grep ESTAB | head -15'),
      this.connection.exec("ss -s 2>/dev/null || netstat -s 2>/dev/null | head -20"),
    ]);
    return `<div class="git-section-title">Listening Ports</div><pre class="admin-pre">${this._esc(listen.stdout.trim())}</pre>
      <div class="git-section-title">Active Connections</div><pre class="admin-pre">${this._esc(established.stdout.trim())}</pre>
      <div class="git-section-title">Socket Stats</div><pre class="admin-pre">${this._esc(states.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>ss -tlnp</code> — Shows listening TCP ports with PID. <code>ss -s</code> gives socket summary (total, TCP states). High TIME-WAIT = connection churn.</div>`;
  }

  async _section_processes() {
    const [tree, zombie, top5cpu] = await Promise.all([
      this.connection.exec('ps auxf 2>/dev/null | head -30 || ps aux 2>/dev/null | head -30'),
      this.connection.exec('ps aux 2>/dev/null | awk \'$8=="Z"{print}\''),
      this.connection.exec('ps aux --sort=-%cpu 2>/dev/null | head -6'),
    ]);
    const zombies = zombie.stdout.trim();
    return `<div class="git-section-title">Process Tree</div><pre class="admin-pre" style="font-size:10px">${this._esc(tree.stdout.trim())}</pre>
      <div class="git-section-title">Top CPU</div><pre class="admin-pre">${this._esc(top5cpu.stdout.trim())}</pre>
      ${zombies ? `<div class="git-section-title" style="color:var(--accent-red)">Zombie Processes</div><pre class="admin-pre">${this._esc(zombies)}</pre>` : '<div class="devops-status">No zombie processes ✓</div>'}
      <div class="devops-card-actions"><input id="admin-kill-pid" placeholder="PID" style="width:60px;padding:4px;background:var(--bg-tertiary);border:1px solid var(--bg-hover,#333);border-radius:3px;color:var(--text-bright);font-size:11px">
      <button class="devops-install-btn secondary" id="admin-kill-btn">Kill PID</button>
      <button class="devops-install-btn secondary" id="admin-kill9-btn" style="color:var(--accent-red)">Kill -9</button></div>
      <div class="admin-learn">💡 <code>ps auxf</code> — Process forest showing parent-child relationships. Zombie (Z) = finished child not reaped by parent. <code>kill -9</code> = force kill (SIGKILL).</div>`;
  }

  async _section_services() {
    const [running, failed, enabled] = await Promise.all([
      this.connection.exec('systemctl list-units --type=service --state=running --no-legend 2>/dev/null | head -25'),
      this.connection.exec('systemctl list-units --type=service --state=failed --no-legend 2>/dev/null'),
      this.connection.exec('systemctl list-unit-files --type=service --state=enabled --no-legend 2>/dev/null | head -20'),
    ]);
    const failedList = failed.stdout.trim();
    let html = failedList ? `<div class="git-section-title" style="color:var(--accent-red)">Failed Services</div><pre class="admin-pre" style="color:var(--accent-red)">${this._esc(failedList)}</pre>` : '';
    html += `<div class="git-section-title">Running (${running.stdout.trim().split('\n').length})</div><pre class="admin-pre" style="font-size:10px">${this._esc(running.stdout.trim())}</pre>`;
    html += `<div class="devops-card-actions"><input id="admin-svc-name" placeholder="service-name" style="width:120px;padding:4px;background:var(--bg-tertiary);border:1px solid var(--bg-hover,#333);border-radius:3px;color:var(--text-bright);font-size:11px">
      <button class="devops-install-btn secondary" id="admin-svc-start">Start</button>
      <button class="devops-install-btn secondary" id="admin-svc-restart">Restart</button>
      <button class="devops-install-btn secondary" id="admin-svc-stop" style="color:var(--accent-red)">Stop</button>
      <button class="devops-install-btn secondary" id="admin-svc-status">Status</button></div>`;
    html += `<div class="admin-learn">💡 <code>systemctl list-units --state=failed</code> — Shows crashed services. <code>journalctl -u service-name -n 50</code> to debug. <code>systemctl enable</code> = start on boot.</div>`;
    return html;
  }

  async _section_users() {
    const [users, groups, lastlog, whoami] = await Promise.all([
      this.connection.exec("awk -F: '$3>=1000||$3==0{print $1\"|\"$3\"|\"$6\"|\"$7}' /etc/passwd"),
      this.connection.exec('cat /etc/group | head -20'),
      this.connection.exec('last -10 2>/dev/null'),
      this.connection.exec('whoami && id'),
    ]);
    return `<div class="admin-grid"><div class="admin-stat"><div class="admin-stat-label">Current User</div><div class="admin-stat-value">${this._esc(whoami.stdout.trim().split('\n')[0])}</div></div></div>
      <div class="git-section-title">System Users</div><pre class="admin-pre">${this._esc(users.stdout.trim())}</pre>
      <div class="git-section-title">Last Logins</div><pre class="admin-pre">${this._esc(lastlog.stdout.trim())}</pre>
      <div class="devops-card-actions"><input id="admin-new-user" placeholder="username" style="width:100px;padding:4px;background:var(--bg-tertiary);border:1px solid var(--bg-hover,#333);border-radius:3px;color:var(--text-bright);font-size:11px">
      <button class="devops-install-btn secondary" id="admin-useradd">Add User</button>
      <button class="devops-install-btn secondary" id="admin-userdel" style="color:var(--accent-red)">Delete User</button></div>
      <div class="admin-learn">💡 <code>awk -F: '$3>=1000' /etc/passwd</code> — Lists real users (UID≥1000). <code>last</code> shows login history. <code>useradd -m -s /bin/bash</code> creates with home dir.</div>`;
  }

  async _section_security() {
    const [failedLogins, suid, openPorts, lastb] = await Promise.all([
      this.connection.exec('journalctl _SYSTEMD_UNIT=sshd.service 2>/dev/null | grep -i "failed\\|invalid" | tail -10 || grep -i "failed" /var/log/auth.log 2>/dev/null | tail -10 || grep -i "failed" /var/log/secure 2>/dev/null | tail -10'),
      this.connection.exec('find / -perm -4000 -type f 2>/dev/null | head -15'),
      this.connection.exec('ss -tlnp 2>/dev/null | grep -v "127.0.0" | grep LISTEN'),
      this.connection.exec('lastb 2>/dev/null | head -10 || echo "lastb not available"'),
    ]);
    return `<div class="git-section-title" style="color:var(--accent-red)">Failed SSH Logins (recent)</div><pre class="admin-pre" style="font-size:10px">${this._esc(failedLogins.stdout.trim() || 'None found')}</pre>
      <div class="git-section-title">SUID Binaries (potential privilege escalation)</div><pre class="admin-pre" style="font-size:10px">${this._esc(suid.stdout.trim())}</pre>
      <div class="git-section-title">External Listening Ports</div><pre class="admin-pre">${this._esc(openPorts.stdout.trim())}</pre>
      <div class="git-section-title">Failed Login Attempts</div><pre class="admin-pre" style="font-size:10px">${this._esc(lastb.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>find / -perm -4000</code> — SUID files run as owner (often root). Attackers exploit these. <code>lastb</code> shows failed login attempts — brute force indicators. Close unnecessary ports!</div>`;
  }

  async _section_ssh() {
    const [keys, authKeys, config] = await Promise.all([
      this.connection.exec('ls -la ~/.ssh/ 2>/dev/null'),
      this.connection.exec('cat ~/.ssh/authorized_keys 2>/dev/null | head -5'),
      this.connection.exec('grep -v "^#" /etc/ssh/sshd_config 2>/dev/null | grep -v "^$" | head -20'),
    ]);
    return `<div class="git-section-title">SSH Directory</div><pre class="admin-pre">${this._esc(keys.stdout.trim())}</pre>
      <div class="git-section-title">Authorized Keys</div><pre class="admin-pre" style="font-size:10px">${this._esc(authKeys.stdout.trim() || 'No authorized_keys')}</pre>
      <div class="git-section-title">SSHD Config (active)</div><pre class="admin-pre" style="font-size:10px">${this._esc(config.stdout.trim())}</pre>
      <div class="devops-card-actions"><button class="devops-install-btn secondary" id="admin-ssh-keygen">Generate SSH Key</button></div>
      <div class="admin-learn">💡 <code>ssh-keygen -t ed25519</code> — Generate modern SSH key (ed25519 > RSA). <code>PermitRootLogin no</code> + <code>PasswordAuthentication no</code> = best practice for hardening.</div>`;
  }

  async _section_firewall() {
    const [rules, zones] = await Promise.all([
      this.connection.exec('sudo iptables -L -n --line-numbers 2>/dev/null || sudo ufw status verbose 2>/dev/null || echo "No firewall active"'),
      this.connection.exec('sudo firewall-cmd --list-all 2>/dev/null || echo ""'),
    ]);
    return `<pre class="admin-pre">${this._esc(rules.stdout.trim())}</pre>
      ${zones.stdout.trim() ? `<div class="git-section-title">Firewalld Zones</div><pre class="admin-pre">${this._esc(zones.stdout.trim())}</pre>` : ''}
      <div class="devops-card-actions">
        <input id="admin-fw-port" placeholder="80/tcp" style="width:80px;padding:4px;background:var(--bg-tertiary);border:1px solid var(--bg-hover,#333);border-radius:3px;color:var(--text-bright);font-size:11px">
        <button class="devops-install-btn secondary" id="admin-fw-allow">Allow</button>
        <button class="devops-install-btn secondary" id="admin-fw-deny" style="color:var(--accent-red)">Deny</button>
        <button class="devops-install-btn secondary" id="admin-fw-list">Reload Rules</button>
      </div>
      <div class="admin-learn">💡 <code>iptables -L -n</code> — List firewall rules. Chain INPUT = incoming. Policy ACCEPT = default allow (dangerous). Best: DROP default, only ACCEPT specific ports.</div>`;
  }

  async _section_packages() {
    const [installed, updates, pm] = await Promise.all([
      this.connection.exec('rpm -qa --last 2>/dev/null | head -15 || dpkg -l 2>/dev/null | tail -15 || apk list --installed 2>/dev/null | head -15'),
      this.connection.exec('yum check-update 2>/dev/null | tail -10 || apt list --upgradable 2>/dev/null | head -10 || echo "Check manually"'),
      this.connection.exec('which yum dnf apt-get apk 2>/dev/null | head -1'),
    ]);
    return `<div class="admin-grid"><div class="admin-stat"><div class="admin-stat-label">Package Manager</div><div class="admin-stat-value">${this._esc(pm.stdout.trim().split('/').pop())}</div></div></div>
      <div class="git-section-title">Recently Installed</div><pre class="admin-pre" style="font-size:10px">${this._esc(installed.stdout.trim())}</pre>
      <div class="git-section-title">Available Updates</div><pre class="admin-pre" style="font-size:10px">${this._esc(updates.stdout.trim())}</pre>
      <div class="devops-card-actions"><input id="admin-pkg-name" placeholder="package-name" style="width:120px;padding:4px;background:var(--bg-tertiary);border:1px solid var(--bg-hover,#333);border-radius:3px;color:var(--text-bright);font-size:11px">
      <button class="devops-install-btn secondary" id="admin-pkg-install">Install</button>
      <button class="devops-install-btn secondary" id="admin-pkg-remove" style="color:var(--accent-red)">Remove</button>
      <button class="devops-install-btn secondary" id="admin-pkg-search">Search</button></div>
      <div class="admin-learn">💡 <code>rpm -qa --last</code> — Lists packages by install date. Always <code>yum update</code> regularly for security patches. <code>yum history</code> shows transaction history for rollback.</div>`;
  }

  async _section_logs() {
    const [journal, dmesg, syslog] = await Promise.all([
      this.connection.exec('journalctl --no-pager -n 20 --output=short-iso 2>/dev/null || tail -20 /var/log/messages 2>/dev/null'),
      this.connection.exec('dmesg --time-format=iso 2>/dev/null | tail -15 || dmesg 2>/dev/null | tail -15'),
      this.connection.exec('journalctl -p err --no-pager -n 10 2>/dev/null || grep -i error /var/log/syslog 2>/dev/null | tail -10'),
    ]);
    return `<div class="git-section-title">System Journal (latest)</div><pre class="admin-pre" style="font-size:10px">${this._esc(journal.stdout.trim())}</pre>
      <div class="git-section-title">Kernel Messages (dmesg)</div><pre class="admin-pre" style="font-size:10px">${this._esc(dmesg.stdout.trim())}</pre>
      <div class="git-section-title" style="color:var(--accent-red)">Errors Only</div><pre class="admin-pre" style="font-size:10px;color:var(--accent-red)">${this._esc(syslog.stdout.trim() || 'No errors')}</pre>
      <div class="admin-learn">💡 <code>journalctl -p err</code> — Shows only error-level messages. <code>journalctl -u service -f</code> = live tail. <code>dmesg</code> = kernel ring buffer (hardware errors, OOM kills).</div>`;
  }

  async _section_cron() {
    const [crontab, timers, atjobs] = await Promise.all([
      this.connection.exec('crontab -l 2>/dev/null; echo "---SYSTEM---"; cat /etc/crontab 2>/dev/null'),
      this.connection.exec('systemctl list-timers --no-pager 2>/dev/null | head -15'),
      this.connection.exec('atq 2>/dev/null || echo "at not installed"'),
    ]);
    return `<div class="git-section-title">User Crontab</div><pre class="admin-pre">${this._esc(crontab.stdout.split('---SYSTEM---')[0].trim() || 'No crontab')}</pre>
      <div class="git-section-title">System Crontab</div><pre class="admin-pre" style="font-size:10px">${this._esc(crontab.stdout.split('---SYSTEM---')[1]?.trim() || '')}</pre>
      <div class="git-section-title">Systemd Timers</div><pre class="admin-pre" style="font-size:10px">${this._esc(timers.stdout.trim())}</pre>
      <div class="devops-card-actions"><input id="admin-cron-line" placeholder="*/5 * * * * /path/cmd" style="width:200px;padding:4px;background:var(--bg-tertiary);border:1px solid var(--bg-hover,#333);border-radius:3px;color:var(--text-bright);font-size:11px">
      <button class="devops-install-btn secondary" id="admin-cron-add">Add Cron Job</button></div>
      <div class="admin-learn">💡 Cron format: <code>min hour dom mon dow command</code>. <code>*/5</code> = every 5 mins. Systemd timers are modern alternative with better logging. <code>systemctl list-timers</code> shows next trigger time.</div>`;
  }

  async _section_dns() {
    const [resolv, hosts, dig] = await Promise.all([
      this.connection.exec('cat /etc/resolv.conf 2>/dev/null'),
      this.connection.exec('cat /etc/hosts 2>/dev/null'),
      this.connection.exec('dig +short google.com 2>/dev/null || nslookup google.com 2>/dev/null | tail -5 || echo "dig/nslookup not installed"'),
    ]);
    return `<div class="git-section-title">/etc/resolv.conf</div><pre class="admin-pre">${this._esc(resolv.stdout.trim())}</pre>
      <div class="git-section-title">/etc/hosts</div><pre class="admin-pre">${this._esc(hosts.stdout.trim())}</pre>
      <div class="git-section-title">DNS Test (google.com)</div><pre class="admin-pre">${this._esc(dig.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>/etc/resolv.conf</code> — DNS servers used. <code>/etc/hosts</code> — Local overrides (checked first). <code>dig +trace</code> shows full DNS resolution path for debugging.</div>`;
  }

  async _section_kernel() {
    const [sysctl, modules, version] = await Promise.all([
      this.connection.exec('sysctl -a 2>/dev/null | grep -E "net.core|vm.swappiness|net.ipv4.tcp|fs.file-max" | sort | head -20'),
      this.connection.exec('lsmod 2>/dev/null | head -15 || echo "lsmod not available"'),
      this.connection.exec('uname -a'),
    ]);
    return `<div class="git-section-title">Kernel</div><pre class="admin-pre">${this._esc(version.stdout.trim())}</pre>
      <div class="git-section-title">Key Sysctl Parameters</div><pre class="admin-pre" style="font-size:10px">${this._esc(sysctl.stdout.trim())}</pre>
      <div class="git-section-title">Loaded Modules</div><pre class="admin-pre" style="font-size:10px">${this._esc(modules.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>vm.swappiness=10</code> — Reduce swapping (default 60 too aggressive for servers). <code>net.core.somaxconn=65535</code> — Allow more TCP connections. Apply: <code>sysctl -w param=value</code>.</div>`;
  }

  async _section_storage() {
    const [mounts, fstab, lvm] = await Promise.all([
      this.connection.exec('mount | grep -v "tmpfs\\|cgroup\\|proc\\|sys" | head -15'),
      this.connection.exec('cat /etc/fstab 2>/dev/null | grep -v "^#" | grep -v "^$"'),
      this.connection.exec('lvs 2>/dev/null || echo "No LVM"'),
    ]);
    return `<div class="git-section-title">Active Mounts</div><pre class="admin-pre" style="font-size:10px">${this._esc(mounts.stdout.trim())}</pre>
      <div class="git-section-title">/etc/fstab</div><pre class="admin-pre" style="font-size:10px">${this._esc(fstab.stdout.trim())}</pre>
      <div class="git-section-title">LVM</div><pre class="admin-pre">${this._esc(lvm.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>/etc/fstab</code> — Persistent mounts (survives reboot). Format: <code>device mountpoint fs options dump pass</code>. LVM allows online resize: <code>lvextend + resize2fs</code>.</div>`;
  }

  async _section_limits() {
    const [ulimit, fileMax, conntrack] = await Promise.all([
      this.connection.exec('ulimit -a 2>/dev/null'),
      this.connection.exec('cat /proc/sys/fs/file-max 2>/dev/null && echo "---" && cat /proc/sys/fs/file-nr 2>/dev/null'),
      this.connection.exec('cat /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null || echo "N/A"'),
    ]);
    return `<div class="git-section-title">User Limits (ulimit -a)</div><pre class="admin-pre" style="font-size:10px">${this._esc(ulimit.stdout.trim())}</pre>
      <div class="git-section-title">File Descriptors</div><pre class="admin-pre">${this._esc(fileMax.stdout.trim())}</pre>
      <div class="admin-grid"><div class="admin-stat"><div class="admin-stat-label">Conntrack Max</div><div class="admin-stat-value">${this._esc(conntrack.stdout.trim())}</div></div></div>
      <div class="admin-learn">💡 <code>ulimit -n</code> — Max open files per process (default 1024 too low for servers). Set in <code>/etc/security/limits.conf</code>: <code>* soft nofile 65535</code>. Conntrack exhaustion = dropped connections.</div>`;
  }

  async _section_boot() {
    const [analyze, blame, target] = await Promise.all([
      this.connection.exec('systemd-analyze 2>/dev/null || echo "systemd-analyze not available"'),
      this.connection.exec('systemd-analyze blame 2>/dev/null | head -15'),
      this.connection.exec('systemctl get-default 2>/dev/null'),
    ]);
    return `<div class="git-section-title">Boot Time</div><pre class="admin-pre">${this._esc(analyze.stdout.trim())}</pre>
      <div class="git-section-title">Slowest Services (blame)</div><pre class="admin-pre" style="font-size:10px">${this._esc(blame.stdout.trim())}</pre>
      <div class="admin-grid"><div class="admin-stat"><div class="admin-stat-label">Default Target</div><div class="admin-stat-value">${this._esc(target.stdout.trim())}</div></div></div>
      <div class="admin-learn">💡 <code>systemd-analyze blame</code> — Shows what slowed boot. Disable unneeded services: <code>systemctl disable slow-service</code>. <code>multi-user.target</code> = no GUI (servers).</div>`;
  }

  async _section_env() {
    const [env, path, shell] = await Promise.all([
      this.connection.exec('env | sort | head -30'),
      this.connection.exec('echo $PATH | tr ":" "\\n"'),
      this.connection.exec('echo $SHELL && cat /etc/shells 2>/dev/null'),
    ]);
    return `<div class="git-section-title">Environment Variables</div><pre class="admin-pre" style="font-size:10px">${this._esc(env.stdout.trim())}</pre>
      <div class="git-section-title">PATH</div><pre class="admin-pre" style="font-size:10px">${this._esc(path.stdout.trim())}</pre>
      <div class="git-section-title">Shell</div><pre class="admin-pre">${this._esc(shell.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>env</code> — All environment variables. <code>export VAR=value</code> sets for current session. Persist in <code>~/.bashrc</code> or <code>/etc/environment</code>. PATH order matters — first match wins.</div>`;
  }

  async _section_permissions() {
    const [suid, worldWrite, noOwner] = await Promise.all([
      this.connection.exec('find /usr /bin /sbin -perm -4000 -type f 2>/dev/null | head -10'),
      this.connection.exec('find /tmp /var -perm -0002 -type f 2>/dev/null | head -10'),
      this.connection.exec('find / -nouser -o -nogroup 2>/dev/null | head -10 || echo "None"'),
    ]);
    return `<div class="git-section-title">SUID Binaries (run as root)</div><pre class="admin-pre" style="font-size:10px">${this._esc(suid.stdout.trim())}</pre>
      <div class="git-section-title">World-Writable Files</div><pre class="admin-pre" style="font-size:10px">${this._esc(worldWrite.stdout.trim() || 'None found ✓')}</pre>
      <div class="git-section-title">No Owner Files</div><pre class="admin-pre" style="font-size:10px">${this._esc(noOwner.stdout.trim())}</pre>
      <div class="admin-learn">💡 SUID (<code>chmod u+s</code>) = runs as file owner. World-writable = anyone can modify (security risk). <code>find / -nouser</code> = orphaned files from deleted users. Fix: <code>chown root:root</code>.</div>`;
  }

  async _section_namespaces() {
    const [ns, pidns, mntns, userns] = await Promise.all([
      this.connection.exec('lsns 2>/dev/null | head -25 || ls -la /proc/1/ns/ 2>/dev/null'),
      this.connection.exec('ls -la /proc/self/ns/pid 2>/dev/null && readlink /proc/self/ns/pid'),
      this.connection.exec('cat /proc/self/mountinfo 2>/dev/null | wc -l'),
      this.connection.exec('cat /proc/self/uid_map 2>/dev/null'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌─────────────────── Linux Kernel ───────────────────┐
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │  PID NS  │  │  NET NS  │  │  MNT NS  │         │
│  │ Isolates │  │ Isolates │  │ Isolates │         │
│  │ process  │  │ network  │  │ mount    │         │
│  │ tree     │  │ stack    │  │ points   │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │  UTS NS  │  │  IPC NS  │  │  USER NS │         │
│  │ Isolates │  │ Isolates │  │ Isolates │         │
│  │ hostname │  │ IPC/shm  │  │ uid/gid  │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│  ┌──────────┐  ┌──────────┐                        │
│  │ CGROUP NS│  │  TIME NS │                        │
│  │ Isolates │  │ Isolates │                        │
│  │ cgroup   │  │ clocks   │                        │
│  └──────────┘  └──────────┘                        │
└─────────────────────────────────────────────────────┘</pre>
      <div class="git-section-title">Active Namespaces</div><pre class="admin-pre" style="font-size:10px">${this._esc(ns.stdout.trim())}</pre>
      <div class="git-section-title">Current Process Namespaces</div><pre class="admin-pre">PID NS:  ${this._esc(pidns.stdout.trim())}
Mount points: ${this._esc(mntns.stdout.trim())}
UID map: ${this._esc(userns.stdout.trim())}</pre>
      <div class="devops-card-actions">
        <button class="devops-install-btn secondary" id="admin-ns-create-net">Create Network NS</button>
        <button class="devops-install-btn secondary" id="admin-ns-create-pid">Run in PID NS</button>
        <button class="devops-install-btn secondary" id="admin-ns-list">List All NS</button>
      </div>
      <div class="admin-learn">💡 <code>lsns</code> — List all namespaces. Linux has 8 namespace types. Containers use ALL of them for isolation. <code>unshare --pid --fork bash</code> creates a new PID namespace. <code>nsenter</code> enters existing ones.</div>`;
  }

  async _section_cgroups() {
    const [version, groups, memCg, cpuCg] = await Promise.all([
      this.connection.exec('stat -fc %T /sys/fs/cgroup 2>/dev/null; mount | grep cgroup | head -3'),
      this.connection.exec('cat /proc/cgroups 2>/dev/null'),
      this.connection.exec('cat /sys/fs/cgroup/memory/memory.usage_in_bytes 2>/dev/null || cat /sys/fs/cgroup/memory.current 2>/dev/null || echo "cgroup v2"'),
      this.connection.exec('ls /sys/fs/cgroup/ 2>/dev/null | head -20'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌─────────── Control Groups (cgroups) ──────────────┐
│                                                     │
│  cgroup root (/)                                    │
│  ├── system.slice/     (systemd services)           │
│  │   ├── sshd.service  [cpu: 10%, mem: 50MB]       │
│  │   ├── docker.service [cpu: 30%, mem: 200MB]     │
│  │   └── nginx.service  [cpu: 5%, mem: 30MB]       │
│  ├── user.slice/       (user sessions)              │
│  │   └── user-0.slice  [cpu: 20%, mem: 100MB]      │
│  └── docker/           (containers)                 │
│      ├── container-a   [cpu: 2 cores, mem: 512MB]  │
│      └── container-b   [cpu: 1 core, mem: 256MB]   │
│                                                     │
│  Controllers: cpu, memory, io, pids, cpuset         │
└─────────────────────────────────────────────────────┘</pre>
      <div class="git-section-title">Cgroup Controllers</div><pre class="admin-pre" style="font-size:10px">${this._esc(groups.stdout.trim())}</pre>
      <div class="git-section-title">Cgroup Hierarchy</div><pre class="admin-pre">${this._esc(cpuCg.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>cgroups</code> limit resources (CPU, memory, I/O, PIDs). v1 has separate hierarchies per controller. v2 has unified hierarchy. Docker uses cgroups for <code>--memory</code> and <code>--cpus</code> limits. <code>systemd-cgls</code> shows the tree.</div>`;
  }

  async _section_capabilities() {
    const [caps, capBound, capAmb] = await Promise.all([
      this.connection.exec('cat /proc/self/status 2>/dev/null | grep -i cap'),
      this.connection.exec('grep -r "" /proc/1/status 2>/dev/null | grep Cap | head -5'),
      this.connection.exec('getpcaps 1 2>/dev/null || echo "getpcaps not available"'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌────────── Linux Capabilities ─────────────┐
│                                            │
│  Root (ALL 41 capabilities)                │
│  ├── CAP_NET_BIND_SERVICE  (bind < 1024)  │
│  ├── CAP_NET_RAW           (raw sockets)  │
│  ├── CAP_SYS_ADMIN         (mount, ns)    │
│  ├── CAP_SYS_PTRACE        (debug procs)  │
│  ├── CAP_DAC_OVERRIDE      (bypass perms) │
│  ├── CAP_CHOWN             (change owner) │
│  ├── CAP_KILL              (send signals) │
│  └── CAP_NET_ADMIN         (network cfg)  │
│                                            │
│  Non-root process: 0 capabilities          │
│  Container default: ~14 capabilities       │
│  --privileged: ALL capabilities            │
└────────────────────────────────────────────┘</pre>
      <div class="git-section-title">Current Process Capabilities</div><pre class="admin-pre" style="font-size:10px">${this._esc(caps.stdout.trim())}</pre>
      <div class="git-section-title">PID 1 (init) Capabilities</div><pre class="admin-pre" style="font-size:10px">${this._esc(capBound.stdout.trim())}</pre>
      <div class="admin-learn">💡 Capabilities split root power into 41 pieces. Instead of running as root, grant specific caps: <code>setcap cap_net_bind_service+ep /usr/bin/node</code> lets Node bind port 80 without root. Docker drops dangerous caps by default.</div>`;
  }

  async _section_seccomp() {
    const [seccomp, apparmor, profiles] = await Promise.all([
      this.connection.exec('grep Seccomp /proc/self/status 2>/dev/null; cat /proc/sys/kernel/seccomp/actions_avail 2>/dev/null'),
      this.connection.exec('cat /sys/module/apparmor/parameters/enabled 2>/dev/null; aa-status 2>/dev/null | head -10 || echo "AppArmor not active"'),
      this.connection.exec('ls /etc/apparmor.d/ 2>/dev/null | head -10 || echo "No profiles"'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌───────── Syscall Filtering ──────────┐
│                                       │
│  User Process                         │
│       │ syscall (e.g. write())        │
│       ▼                               │
│  ┌─────────────┐                      │
│  │  Seccomp    │ ← BPF filter         │
│  │  Filter     │   ALLOW / KILL /     │
│  │             │   ERRNO / TRACE      │
│  └──────┬──────┘                      │
│         ▼                             │
│  ┌─────────────┐                      │
│  │  AppArmor/  │ ← MAC policy         │
│  │  SELinux    │   file, net, caps    │
│  └──────┬──────┘                      │
│         ▼                             │
│  ┌─────────────┐                      │
│  │   Kernel    │                      │
│  └─────────────┘                      │
└───────────────────────────────────────┘</pre>
      <div class="git-section-title">Seccomp Status</div><pre class="admin-pre">${this._esc(seccomp.stdout.trim())}</pre>
      <div class="git-section-title">AppArmor</div><pre class="admin-pre" style="font-size:10px">${this._esc(apparmor.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>Seccomp</code> filters syscalls via BPF. Mode 2 = filter mode (Docker default blocks ~44 dangerous syscalls like <code>reboot</code>, <code>mount</code>). AppArmor restricts file/network access per-program via profiles.</div>`;
  }

  async _section_procfs() {
    const [cpuinfo, meminfo, version, cmdline, filesystems] = await Promise.all([
      this.connection.exec('head -20 /proc/cpuinfo 2>/dev/null'),
      this.connection.exec('head -15 /proc/meminfo 2>/dev/null'),
      this.connection.exec('cat /proc/version 2>/dev/null'),
      this.connection.exec('cat /proc/cmdline 2>/dev/null'),
      this.connection.exec('cat /proc/filesystems 2>/dev/null | grep -v nodev'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌──────────── /proc Virtual Filesystem ────────────┐
│                                                    │
│  /proc/                                            │
│  ├── cpuinfo        CPU model, cores, flags        │
│  ├── meminfo        Detailed memory breakdown      │
│  ├── loadavg        1/5/15 min load averages       │
│  ├── version        Kernel version + compiler      │
│  ├── cmdline        Kernel boot parameters         │
│  ├── filesystems    Supported filesystem types     │
│  ├── partitions     Block devices                  │
│  ├── net/           Network stats & config         │
│  │   ├── tcp        Active TCP connections         │
│  │   ├── dev        Interface byte counts          │
│  │   └── route      Kernel routing table           │
│  ├── sys/           Tunable kernel parameters      │
│  │   ├── vm/        Memory management              │
│  │   ├── net/       Network stack tuning           │
│  │   └── fs/        Filesystem limits              │
│  └── [PID]/         Per-process info               │
│      ├── status     Process state, memory, caps    │
│      ├── maps       Memory mappings (mmap)         │
│      ├── fd/        Open file descriptors          │
│      └── ns/        Namespace links                │
└────────────────────────────────────────────────────┘</pre>
      <div class="git-section-title">/proc/cpuinfo</div><pre class="admin-pre" style="font-size:10px">${this._esc(cpuinfo.stdout.trim())}</pre>
      <div class="git-section-title">/proc/meminfo</div><pre class="admin-pre" style="font-size:10px">${this._esc(meminfo.stdout.trim())}</pre>
      <div class="git-section-title">Boot cmdline</div><pre class="admin-pre" style="font-size:10px">${this._esc(cmdline.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>/proc</code> is a virtual filesystem — files don't exist on disk. Kernel generates them on read. Every process has <code>/proc/[PID]/</code>. This is how tools like <code>ps</code>, <code>top</code>, <code>free</code> work — they read /proc.</div>`;
  }

  async _section_sysfs() {
    const [block, net, cpu, pci] = await Promise.all([
      this.connection.exec('ls /sys/block/ 2>/dev/null'),
      this.connection.exec('ls /sys/class/net/ 2>/dev/null'),
      this.connection.exec('ls /sys/devices/system/cpu/ 2>/dev/null | grep cpu[0-9]'),
      this.connection.exec('lspci 2>/dev/null | head -10 || ls /sys/bus/pci/devices/ 2>/dev/null | head -10'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌──────────── /sys Virtual Filesystem ─────────────┐
│                                                    │
│  /sys/                                             │
│  ├── block/          Block devices (sda, nvme)     │
│  ├── bus/            Bus types (pci, usb, scsi)    │
│  ├── class/          Device classes                │
│  │   ├── net/        Network interfaces            │
│  │   ├── block/      Block devices                 │
│  │   └── tty/        Terminal devices              │
│  ├── devices/        Device hierarchy              │
│  │   └── system/                                   │
│  │       ├── cpu/    CPU topology & freq           │
│  │       ├── memory/ NUMA memory nodes             │
│  │       └── node/   NUMA nodes                    │
│  ├── fs/             Filesystem info               │
│  │   └── cgroup/     Cgroup controllers            │
│  └── kernel/         Kernel objects                │
│      └── mm/         Memory management             │
└────────────────────────────────────────────────────┘</pre>
      <div class="git-section-title">Block Devices</div><pre class="admin-pre">${this._esc(block.stdout.trim())}</pre>
      <div class="git-section-title">Network Interfaces</div><pre class="admin-pre">${this._esc(net.stdout.trim())}</pre>
      <div class="git-section-title">CPUs</div><pre class="admin-pre">${this._esc(cpu.stdout.trim())}</pre>
      <div class="git-section-title">PCI Devices</div><pre class="admin-pre" style="font-size:10px">${this._esc(pci.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>/sys</code> exposes kernel device model. Unlike /proc (process info), /sys is hardware. You can tune devices: <code>echo 1024 > /sys/block/sda/queue/nr_requests</code> changes disk queue depth.</div>`;
  }

  async _section_signals() {
    const [siglist, pending, ipc] = await Promise.all([
      this.connection.exec('kill -l 2>/dev/null'),
      this.connection.exec('cat /proc/self/status 2>/dev/null | grep -i sig'),
      this.connection.exec('ipcs 2>/dev/null || echo "ipcs not available"'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌────────── Linux Signals ──────────────────┐
│                                            │
│  Signal    #   Default    Use              │
│  ─────────────────────────────────────     │
│  SIGHUP    1   Terminate  Reload config    │
│  SIGINT    2   Terminate  Ctrl+C           │
│  SIGQUIT   3   Core dump  Ctrl+\\           │
│  SIGKILL   9   Terminate  Force kill ☠️     │
│  SIGSEGV  11   Core dump  Segfault         │
│  SIGTERM  15   Terminate  Graceful stop    │
│  SIGSTOP  19   Stop       Pause (freeze)   │
│  SIGCONT  18   Continue   Resume           │
│  SIGUSR1  10   Terminate  User-defined     │
│  SIGUSR2  12   Terminate  User-defined     │
│                                            │
│  SIGKILL & SIGSTOP cannot be caught!       │
└────────────────────────────────────────────┘</pre>
      <div class="git-section-title">All Signals</div><pre class="admin-pre" style="font-size:10px">${this._esc(siglist.stdout.trim())}</pre>
      <div class="git-section-title">IPC Resources (shared memory, semaphores)</div><pre class="admin-pre" style="font-size:10px">${this._esc(ipc.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>kill -15 PID</code> = graceful (SIGTERM, app can cleanup). <code>kill -9 PID</code> = force (SIGKILL, kernel kills instantly). <code>kill -HUP PID</code> = reload config (nginx, sshd). IPC: shared memory + semaphores for inter-process comms.</div>`;
  }

  async _section_fds() {
    const [fdMax, fdUsed, lsof, openFiles] = await Promise.all([
      this.connection.exec('cat /proc/sys/fs/file-max 2>/dev/null'),
      this.connection.exec('cat /proc/sys/fs/file-nr 2>/dev/null'),
      this.connection.exec('lsof 2>/dev/null | wc -l || echo "lsof not installed"'),
      this.connection.exec('ls -la /proc/self/fd/ 2>/dev/null'),
    ]);
    const nr = fdUsed.stdout.trim().split('\t');
    return `<pre class="admin-pre admin-ascii">
┌──────── File Descriptors ─────────────────┐
│                                            │
│  Process                                   │
│  ├── fd 0 → stdin  (keyboard/pipe)        │
│  ├── fd 1 → stdout (terminal/pipe)        │
│  ├── fd 2 → stderr (terminal/log)         │
│  ├── fd 3 → socket (TCP connection)       │
│  ├── fd 4 → file   (/var/log/app.log)     │
│  └── fd 5 → pipe   (to child process)     │
│                                            │
│  Max per system: ${this._esc(fdMax.stdout.trim()).padEnd(26)}│
│  Allocated:      ${(nr[0] || '?').padEnd(26)}│
│  Free:           ${(nr[1] || '?').padEnd(26)}│
└────────────────────────────────────────────┘</pre>
      <div class="git-section-title">Current Process FDs</div><pre class="admin-pre">${this._esc(openFiles.stdout.trim())}</pre>
      <div class="git-section-title">System-wide Open Files</div><pre class="admin-pre">Total open: ${this._esc(lsof.stdout.trim())}</pre>
      <div class="admin-learn">💡 Everything in Linux is a file — sockets, pipes, devices. <code>lsof</code> lists all open files. <code>ulimit -n</code> = per-process limit (default 1024). For high-traffic servers: set to 65535 in <code>/etc/security/limits.conf</code>.</div>`;
  }

  async _section_netns() {
    const [netns, veths, bridges] = await Promise.all([
      this.connection.exec('ip netns list 2>/dev/null || echo "No network namespaces"'),
      this.connection.exec('ip link show type veth 2>/dev/null | head -10 || echo "No veth pairs"'),
      this.connection.exec('brctl show 2>/dev/null || ip link show type bridge 2>/dev/null | head -10 || echo "No bridges"'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌────── Network Namespaces & Isolation ─────────────┐
│                                                     │
│  Host Network NS                                    │
│  ├── eth0: 172.31.x.x (physical/cloud NIC)        │
│  ├── docker0: 172.17.0.1 (bridge)                  │
│  │   ├── veth123 ←→ container-a (172.17.0.2)      │
│  │   └── veth456 ←→ container-b (172.17.0.3)      │
│  │                                                  │
│  Container-A Network NS                             │
│  ├── eth0: 172.17.0.2 (veth peer)                  │
│  └── lo: 127.0.0.1                                 │
│                                                     │
│  Container-B Network NS                             │
│  ├── eth0: 172.17.0.3 (veth peer)                  │
│  └── lo: 127.0.0.1                                 │
│                                                     │
│  veth = virtual ethernet pair (pipe between NS)    │
└─────────────────────────────────────────────────────┘</pre>
      <div class="git-section-title">Network Namespaces</div><pre class="admin-pre">${this._esc(netns.stdout.trim())}</pre>
      <div class="git-section-title">Veth Pairs</div><pre class="admin-pre" style="font-size:10px">${this._esc(veths.stdout.trim())}</pre>
      <div class="git-section-title">Bridges</div><pre class="admin-pre">${this._esc(bridges.stdout.trim())}</pre>
      <div class="devops-card-actions">
        <button class="devops-install-btn secondary" id="admin-netns-create">Create Net NS "test"</button>
        <button class="devops-install-btn secondary" id="admin-netns-exec">Exec in NS</button>
      </div>
      <div class="admin-learn">💡 <code>ip netns add test</code> creates isolated network stack. <code>ip link add veth0 type veth peer name veth1</code> creates a virtual cable. Move one end into the NS: <code>ip link set veth1 netns test</code>. This is exactly how Docker networking works!</div>`;
  }

  async _section_iptables() {
    const [filter, nat, mangle, conns] = await Promise.all([
      this.connection.exec('sudo iptables -L -n -v --line-numbers 2>/dev/null | head -25'),
      this.connection.exec('sudo iptables -t nat -L -n --line-numbers 2>/dev/null | head -15'),
      this.connection.exec('sudo iptables -t mangle -L -n 2>/dev/null | head -10 || echo "empty"'),
      this.connection.exec('cat /proc/sys/net/netfilter/nf_conntrack_count 2>/dev/null; echo "/"; cat /proc/sys/net/netfilter/nf_conntrack_max 2>/dev/null'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌──────── iptables Packet Flow (Netfilter) ─────────┐
│                                                     │
│  Incoming Packet                                    │
│       │                                             │
│       ▼                                             │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐       │
│  │PREROUTING│───▶│ ROUTING  │───▶│ FORWARD │──┐    │
│  │ (nat)   │    │ Decision │    │ (filter)│  │    │
│  └─────────┘    └────┬─────┘    └─────────┘  │    │
│                      │                        │    │
│                      ▼                        ▼    │
│                 ┌─────────┐          ┌──────────┐  │
│                 │  INPUT  │          │POSTROUTING│  │
│                 │ (filter)│          │  (nat)   │  │
│                 └────┬────┘          └──────────┘  │
│                      │                             │
│                      ▼                             │
│                 ┌─────────┐                        │
│                 │  Local  │                        │
│                 │ Process │                        │
│                 └────┬────┘                        │
│                      │                             │
│                      ▼                             │
│                 ┌─────────┐                        │
│                 │ OUTPUT  │                        │
│                 │ (filter)│                        │
│                 └─────────┘                        │
└─────────────────────────────────────────────────────┘</pre>
      <div class="git-section-title">Filter Table (main firewall)</div><pre class="admin-pre" style="font-size:10px">${this._esc(filter.stdout.trim())}</pre>
      <div class="git-section-title">NAT Table</div><pre class="admin-pre" style="font-size:10px">${this._esc(nat.stdout.trim())}</pre>
      <div class="git-section-title">Conntrack</div><pre class="admin-pre">${this._esc(conns.stdout.trim().replace('\n', ''))}</pre>
      <div class="admin-learn">💡 Packets traverse chains: PREROUTING → INPUT (local) or FORWARD (routed) → POSTROUTING. Docker adds NAT rules for port mapping. <code>conntrack</code> tracks connection state — exhaustion = dropped packets.</div>`;
  }

  async _section_tcpstack() {
    const [tcpParams, connStates, retrans] = await Promise.all([
      this.connection.exec('sysctl net.ipv4.tcp_fin_timeout net.ipv4.tcp_keepalive_time net.core.somaxconn net.ipv4.tcp_max_syn_backlog net.ipv4.ip_local_port_range 2>/dev/null'),
      this.connection.exec("ss -s 2>/dev/null"),
      this.connection.exec('cat /proc/net/snmp 2>/dev/null | grep -A1 Tcp | tail -1 | awk \'{print "Retransmits: "$13" ActiveOpens: "$6" PassiveOpens: "$7}\''),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌────────── TCP Connection Lifecycle ───────────────┐
│                                                     │
│  Client              Server                         │
│    │                   │                            │
│    │──── SYN ────────▶│  (SYN_SENT → SYN_RECV)    │
│    │◀── SYN+ACK ──────│                            │
│    │──── ACK ────────▶│  (ESTABLISHED)             │
│    │                   │                            │
│    │◀──── DATA ──────▶│  (bidirectional)           │
│    │                   │                            │
│    │──── FIN ────────▶│  (FIN_WAIT_1)              │
│    │◀── ACK ──────────│  (FIN_WAIT_2/CLOSE_WAIT)  │
│    │◀── FIN ──────────│  (LAST_ACK)               │
│    │──── ACK ────────▶│  (TIME_WAIT → CLOSED)     │
│    │                   │                            │
│  TIME_WAIT lasts ${this._esc((await this.connection.exec('cat /proc/sys/net/ipv4/tcp_fin_timeout 2>/dev/null')).stdout.trim())}s (tcp_fin_timeout)       │
└─────────────────────────────────────────────────────┘</pre>
      <div class="git-section-title">TCP Parameters</div><pre class="admin-pre">${this._esc(tcpParams.stdout.trim())}</pre>
      <div class="git-section-title">Socket Summary</div><pre class="admin-pre">${this._esc(connStates.stdout.trim())}</pre>
      <div class="git-section-title">TCP Counters</div><pre class="admin-pre">${this._esc(retrans.stdout.trim())}</pre>
      <div class="admin-learn">💡 High TIME_WAIT? Lower <code>tcp_fin_timeout</code> (default 60→15). Many SYN floods? Increase <code>tcp_max_syn_backlog</code>. <code>somaxconn</code> = accept queue size. For 10K+ connections: tune all three.</div>`;
  }

  async _section_scheduler() {
    const [policy, rt, nice, loadavg] = await Promise.all([
      this.connection.exec('chrt -p 1 2>/dev/null || echo "chrt not available"'),
      this.connection.exec('cat /proc/sys/kernel/sched_rt_runtime_us 2>/dev/null'),
      this.connection.exec('ps -eo pid,ni,pri,comm --sort=-pri 2>/dev/null | head -15'),
      this.connection.exec('cat /proc/stat 2>/dev/null | head -1'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌──────── CPU Scheduler ────────────────────┐
│                                            │
│  Scheduling Classes (priority order):      │
│  ┌────────────────────────────────┐       │
│  │ SCHED_DEADLINE  (earliest DL) │ ← RT  │
│  │ SCHED_FIFO     (first in)    │ ← RT  │
│  │ SCHED_RR       (round robin) │ ← RT  │
│  │ SCHED_OTHER    (CFS default) │ ← Most│
│  │ SCHED_BATCH    (CPU-bound)   │       │
│  │ SCHED_IDLE     (lowest prio) │       │
│  └────────────────────────────────┘       │
│                                            │
│  CFS (Completely Fair Scheduler):          │
│  - Red-black tree of runnable tasks       │
│  - Virtual runtime = actual / weight      │
│  - Nice -20 = highest, +19 = lowest      │
│  - nice 0 = default (weight 1024)        │
└────────────────────────────────────────────┘</pre>
      <div class="git-section-title">PID 1 Scheduling Policy</div><pre class="admin-pre">${this._esc(policy.stdout.trim())}</pre>
      <div class="git-section-title">Processes by Priority</div><pre class="admin-pre" style="font-size:10px">${this._esc(nice.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>nice -n -10 command</code> = higher priority. <code>renice -n 5 -p PID</code> = lower running process. CFS ensures fairness — even nice -20 can't starve others. <code>chrt -f 99 command</code> = real-time FIFO (careful!).</div>`;
  }

  async _section_vmm() {
    const [vmstat, hugepages, oom, swappiness] = await Promise.all([
      this.connection.exec('vmstat 1 2 2>/dev/null | tail -1 || cat /proc/vmstat 2>/dev/null | head -15'),
      this.connection.exec('cat /proc/meminfo 2>/dev/null | grep -i huge'),
      this.connection.exec('dmesg 2>/dev/null | grep -i "oom\\|out of memory" | tail -5 || echo "No OOM events"'),
      this.connection.exec('cat /proc/sys/vm/swappiness 2>/dev/null'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌──────── Virtual Memory Manager ───────────────────┐
│                                                     │
│  Process Virtual Address Space (64-bit)             │
│  ┌─────────────────────────┐  0xFFFF...            │
│  │     Kernel Space        │  (top 128TB)          │
│  ├─────────────────────────┤                        │
│  │     Stack ↓             │  (grows down)         │
│  │         ...             │                        │
│  │     Heap  ↑             │  (grows up, malloc)   │
│  │     BSS                 │  (uninitialized)      │
│  │     Data                │  (global variables)   │
│  │     Text (code)         │  (read-only)          │
│  └─────────────────────────┘  0x0000...            │
│                                                     │
│  Page Size: 4KB  |  Huge Pages: 2MB / 1GB          │
│  Swappiness: ${this._esc(swappiness.stdout.trim()).padEnd(5)} (0=never swap, 100=always)   │
│                                                     │
│  Page Fault → Check page table → Load from disk     │
│  OOM Killer → Score processes → Kill highest score  │
└─────────────────────────────────────────────────────┘</pre>
      <div class="git-section-title">VMstat</div><pre class="admin-pre">${this._esc(vmstat.stdout.trim())}</pre>
      <div class="git-section-title">Huge Pages</div><pre class="admin-pre">${this._esc(hugepages.stdout.trim())}</pre>
      <div class="git-section-title">OOM Events</div><pre class="admin-pre" style="font-size:10px">${this._esc(oom.stdout.trim())}</pre>
      <div class="admin-learn">💡 <code>vm.swappiness=10</code> for servers (less swapping). Huge pages reduce TLB misses for databases. OOM killer targets highest <code>oom_score</code>. Protect critical processes: <code>echo -1000 > /proc/PID/oom_score_adj</code>.</div>`;
  }

  async _section_ebpf() {
    const [bpftool, tracepoints, kprobes] = await Promise.all([
      this.connection.exec('bpftool prog list 2>/dev/null | head -10 || echo "bpftool not installed (yum install bpftool)"'),
      this.connection.exec('ls /sys/kernel/debug/tracing/events/ 2>/dev/null | head -15 || ls /sys/kernel/tracing/events/ 2>/dev/null | head -15 || echo "debugfs not mounted"'),
      this.connection.exec('cat /sys/kernel/debug/tracing/available_filter_functions 2>/dev/null | wc -l || echo "N/A"'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌──────── eBPF & Kernel Tracing ────────────────────┐
│                                                     │
│  User Space                                         │
│  ├── bpftool, bpftrace, bcc tools                  │
│  │                                                  │
│  │   ┌─── BPF Program ───┐                         │
│  │   │ Compiled C/Rust   │                         │
│  │   │ → BPF bytecode    │                         │
│  │   └────────┬──────────┘                         │
│  │            │ load                                │
│  ▼            ▼                                     │
│  ┌──── Kernel BPF VM ────┐                         │
│  │ Verifier (safety)     │                         │
│  │ JIT Compiler          │                         │
│  │ Maps (key-value)      │                         │
│  └──────────┬────────────┘                         │
│             │ attach to:                            │
│  ┌──────────┴────────────────────────┐             │
│  │ kprobes  tracepoints  XDP  TC    │             │
│  │ (func)   (events)   (net) (net)  │             │
│  └───────────────────────────────────┘             │
└─────────────────────────────────────────────────────┘</pre>
      <div class="git-section-title">BPF Programs Loaded</div><pre class="admin-pre">${this._esc(bpftool.stdout.trim())}</pre>
      <div class="git-section-title">Tracepoint Categories</div><pre class="admin-pre" style="font-size:10px">${this._esc(tracepoints.stdout.trim())}</pre>
      <div class="git-section-title">Kprobe-able Functions</div><pre class="admin-pre">${this._esc(kprobes.stdout.trim())} functions available</pre>
      <div class="admin-learn">💡 eBPF = programmable kernel hooks. Used by: Cilium (K8s networking), Falco (security), bcc tools (performance). <code>bpftrace -e 'tracepoint:syscalls:sys_enter_open { printf("%s\\n", comm); }'</code> traces file opens in real-time.</div>`;
  }

  async _section_containers() {
    const [dockerInfo, overlay, unshare] = await Promise.all([
      this.connection.exec('docker info 2>/dev/null | grep -E "Storage|Runtime|Cgroup|Kernel|OS" | head -10 || echo "Docker not running"'),
      this.connection.exec('mount | grep overlay 2>/dev/null | head -5 || echo "No overlay mounts"'),
      this.connection.exec('unshare --help 2>/dev/null | head -3 || echo "unshare available"'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌──────── Container = NS + Cgroups + OverlayFS ─────┐
│                                                     │
│  "Container" is NOT a kernel concept.               │
│  It's a combination of:                             │
│                                                     │
│  1. Namespaces (isolation)                          │
│     ├── PID   → own process tree (PID 1 inside)    │
│     ├── NET   → own IP, ports, routes              │
│     ├── MNT   → own filesystem view                │
│     ├── UTS   → own hostname                       │
│     ├── IPC   → own shared memory                  │
│     └── USER  → own uid mapping                    │
│                                                     │
│  2. Cgroups (resource limits)                       │
│     ├── memory.max = 512MB                         │
│     ├── cpu.max = 200000/100000 (2 cores)          │
│     └── pids.max = 1000                            │
│                                                     │
│  3. OverlayFS (copy-on-write filesystem)            │
│     ┌─────────┐                                     │
│     │ upper   │ ← writes go here (container layer) │
│     │ lower   │ ← read-only (image layers)         │
│     │ merged  │ ← what the process sees            │
│     └─────────┘                                     │
│                                                     │
│  4. Seccomp + Capabilities (security)               │
└─────────────────────────────────────────────────────┘</pre>
      <div class="git-section-title">Docker Info</div><pre class="admin-pre" style="font-size:10px">${this._esc(dockerInfo.stdout.trim())}</pre>
      <div class="git-section-title">OverlayFS Mounts</div><pre class="admin-pre" style="font-size:10px">${this._esc(overlay.stdout.trim())}</pre>
      <div class="devops-card-actions">
        <button class="devops-install-btn secondary" id="admin-mini-container">Create Mini Container (unshare)</button>
      </div>
      <div class="admin-learn">💡 You can build a "container" with just: <code>unshare --pid --net --mount --fork bash</code>. Docker adds image management, networking, and UX. Understanding this = understanding containers at the kernel level.</div>`;
  }

  async _section_selinux() {
    const [status, booleans, contexts] = await Promise.all([
      this.connection.exec('getenforce 2>/dev/null || cat /sys/fs/selinux/enforce 2>/dev/null || echo "SELinux not available"'),
      this.connection.exec('getsebool -a 2>/dev/null | head -15 || echo "No SELinux booleans"'),
      this.connection.exec('ls -Z /etc/passwd /usr/bin/ssh /var/log 2>/dev/null || echo "No SELinux contexts"'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌──────── Mandatory Access Control ─────────────────┐
│                                                     │
│  DAC (Traditional)         MAC (SELinux/AppArmor)  │
│  ┌─────────────────┐      ┌─────────────────────┐ │
│  │ Owner: rw-       │      │ Policy: type_t can  │ │
│  │ Group: r--       │      │   read file_t       │ │
│  │ Other: ---       │      │   write log_t       │ │
│  │                  │      │   NOT access ssh_t  │ │
│  │ Root bypasses ✗  │      │   Root CANNOT ✓     │ │
│  └─────────────────┘      └─────────────────────┘ │
│                                                     │
│  SELinux Modes:                                     │
│  ├── Enforcing  = blocks violations                │
│  ├── Permissive = logs but allows                  │
│  └── Disabled   = off completely                   │
│                                                     │
│  Every file/process has a security context:         │
│  user:role:type:level                               │
│  e.g. system_u:object_r:httpd_sys_content_t:s0     │
└─────────────────────────────────────────────────────┘</pre>
      <div class="git-section-title">SELinux Status</div><pre class="admin-pre">${this._esc(status.stdout.trim())}</pre>
      <div class="git-section-title">Booleans (toggleable policies)</div><pre class="admin-pre" style="font-size:10px">${this._esc(booleans.stdout.trim())}</pre>
      <div class="git-section-title">Security Contexts</div><pre class="admin-pre" style="font-size:10px">${this._esc(contexts.stdout.trim())}</pre>
      <div class="admin-learn">💡 SELinux = even root can't bypass policy. <code>setenforce 0</code> = permissive (debug). <code>audit2allow</code> generates rules from denials. AWS AL2023 uses SELinux. If app fails mysteriously, check <code>ausearch -m avc</code>.</div>`;
  }

  async _section_kernelarch() {
    const [version, modules, interrupts, syscalls] = await Promise.all([
      this.connection.exec('uname -a 2>/dev/null'),
      this.connection.exec('lsmod 2>/dev/null | wc -l'),
      this.connection.exec('cat /proc/interrupts 2>/dev/null | head -10'),
      this.connection.exec('cat /proc/kallsyms 2>/dev/null | wc -l || echo "restricted"'),
    ]);
    return `<pre class="admin-pre admin-ascii">
┌──────── Linux Kernel Architecture ────────────────┐
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │               User Space                     │   │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │   │
│  │  │ bash │ │nginx │ │docker│ │ node │       │   │
│  │  └──┬───┘ └──┬───┘ └──┬───┘ └──┬───┘       │   │
│  └─────┼────────┼────────┼────────┼────────────┘   │
│        │ syscall│        │        │                 │
│  ══════╪════════╪════════╪════════╪═══════════════  │
│        ▼        ▼        ▼        ▼                 │
│  ┌─────────────────────────────────────────────┐   │
│  │            Kernel Space                      │   │
│  │  ┌────────────────────────────────────────┐ │   │
│  │  │ System Call Interface (300+ syscalls)   │ │   │
│  │  ├────────────────────────────────────────┤ │   │
│  │  │ VFS │ Scheduler │ Memory │ Net Stack  │ │   │
│  │  ├────────────────────────────────────────┤ │   │
│  │  │ Device Drivers (modules: ${this._esc(modules.stdout.trim()).padEnd(4)})       │ │   │
│  │  ├────────────────────────────────────────┤ │   │
│  │  │ Arch-specific (x86_64, arm64)          │ │   │
│  │  └────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │              Hardware                        │   │
│  │  CPU │ RAM │ Disk │ NIC │ GPU               │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘</pre>
      <div class="git-section-title">Kernel Version</div><pre class="admin-pre">${this._esc(version.stdout.trim())}</pre>
      <div class="git-section-title">Interrupts (hardware→kernel)</div><pre class="admin-pre" style="font-size:10px">${this._esc(interrupts.stdout.trim())}</pre>
      <div class="git-section-title">Kernel Symbols</div><pre class="admin-pre">${this._esc(syscalls.stdout.trim())} symbols in kernel</pre>
      <div class="admin-learn">💡 The kernel is the bridge between hardware and software. User programs CANNOT access hardware directly — they make syscalls (read, write, open, socket). <code>strace -p PID</code> traces syscalls in real-time. Understanding this = understanding Linux.</div>`;
  }

  _bindSectionEvents(section) {
    if (section === 'memory') {
      document.getElementById('admin-drop-cache')?.addEventListener('click', async () => {
        await this.connection.exec('sync && echo 3 | sudo tee /proc/sys/vm/drop_caches');
        window.app.notify('Caches dropped', 'success');
        this._loadSection('memory');
      });
      document.getElementById('admin-create-swap')?.addEventListener('click', async () => {
        const r = await this.connection.exec('sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile 2>&1');
        window.app.notify(r.code === 0 ? 'Swap created' : r.stdout, r.code === 0 ? 'success' : 'error');
        this._loadSection('memory');
      });
    }
    if (section === 'processes') {
      document.getElementById('admin-kill-btn')?.addEventListener('click', async () => {
        const pid = document.getElementById('admin-kill-pid')?.value.trim();
        if (!pid) return;
        await this.connection.exec(`kill ${pid} 2>&1`);
        window.app.notify(`Sent SIGTERM to PID ${pid}`, 'success');
        this._loadSection('processes');
      });
      document.getElementById('admin-kill9-btn')?.addEventListener('click', async () => {
        const pid = document.getElementById('admin-kill-pid')?.value.trim();
        if (!pid) return;
        await this.connection.exec(`kill -9 ${pid} 2>&1`);
        window.app.notify(`Sent SIGKILL to PID ${pid}`, 'success');
        this._loadSection('processes');
      });
    }
    if (section === 'services') {
      ['start', 'restart', 'stop', 'status'].forEach(action => {
        document.getElementById(`admin-svc-${action}`)?.addEventListener('click', async () => {
          const name = document.getElementById('admin-svc-name')?.value.trim();
          if (!name) return;
          const r = await this.connection.exec(`sudo systemctl ${action} ${name} 2>&1`);
          window.app.notify(`${action} ${name}: ${r.code === 0 ? 'OK' : r.stdout}`, r.code === 0 ? 'success' : 'error');
          if (action !== 'status') this._loadSection('services');
          else window.app.notify(r.stdout.substring(0, 200), 'info');
        });
      });
    }
    if (section === 'users') {
      document.getElementById('admin-useradd')?.addEventListener('click', async () => {
        const name = document.getElementById('admin-new-user')?.value.trim();
        if (!name) return;
        const r = await this.connection.exec(`sudo useradd -m -s /bin/bash ${name} 2>&1`);
        window.app.notify(r.code === 0 ? `Created ${name}` : r.stdout, r.code === 0 ? 'success' : 'error');
        this._loadSection('users');
      });
      document.getElementById('admin-userdel')?.addEventListener('click', async () => {
        const name = document.getElementById('admin-new-user')?.value.trim();
        if (!name) return;
        if (!confirm(`Delete user ${name} and home directory?`)) return;
        const r = await this.connection.exec(`sudo userdel -r ${name} 2>&1`);
        window.app.notify(r.code === 0 ? `Deleted ${name}` : r.stdout, r.code === 0 ? 'success' : 'error');
        this._loadSection('users');
      });
    }
    if (section === 'ssh') {
      document.getElementById('admin-ssh-keygen')?.addEventListener('click', async () => {
        const r = await this.connection.exec('ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N "" -q 2>&1 && cat ~/.ssh/id_ed25519.pub');
        window.app.notify(r.code === 0 ? 'Key generated' : r.stdout, r.code === 0 ? 'success' : 'error');
        this._loadSection('ssh');
      });
    }
    if (section === 'firewall') {
      document.getElementById('admin-fw-allow')?.addEventListener('click', async () => {
        const port = document.getElementById('admin-fw-port')?.value.trim();
        if (!port) return;
        const r = await this.connection.exec(`sudo iptables -A INPUT -p tcp --dport ${port.split('/')[0]} -j ACCEPT 2>&1`);
        window.app.notify(r.code === 0 ? `Allowed ${port}` : r.stdout, r.code === 0 ? 'success' : 'error');
        this._loadSection('firewall');
      });
      document.getElementById('admin-fw-deny')?.addEventListener('click', async () => {
        const port = document.getElementById('admin-fw-port')?.value.trim();
        if (!port) return;
        const r = await this.connection.exec(`sudo iptables -A INPUT -p tcp --dport ${port.split('/')[0]} -j DROP 2>&1`);
        window.app.notify(r.code === 0 ? `Denied ${port}` : r.stdout, r.code === 0 ? 'success' : 'error');
        this._loadSection('firewall');
      });
      document.getElementById('admin-fw-list')?.addEventListener('click', () => this._loadSection('firewall'));
    }
    if (section === 'packages') {
      document.getElementById('admin-pkg-install')?.addEventListener('click', async () => {
        const pkg = document.getElementById('admin-pkg-name')?.value.trim();
        if (!pkg) return;
        window.app.notify(`Installing ${pkg}...`, 'info');
        const r = await this.connection.exec(`sudo yum install -y ${pkg} 2>&1 || sudo apt-get install -y ${pkg} 2>&1 || sudo apk add ${pkg} 2>&1`);
        window.app.notify(r.code === 0 ? `Installed ${pkg}` : 'Install failed', r.code === 0 ? 'success' : 'error');
        this._loadSection('packages');
      });
      document.getElementById('admin-pkg-remove')?.addEventListener('click', async () => {
        const pkg = document.getElementById('admin-pkg-name')?.value.trim();
        if (!pkg) return;
        const r = await this.connection.exec(`sudo yum remove -y ${pkg} 2>&1 || sudo apt-get remove -y ${pkg} 2>&1`);
        window.app.notify(r.code === 0 ? `Removed ${pkg}` : 'Remove failed', r.code === 0 ? 'success' : 'error');
        this._loadSection('packages');
      });
      document.getElementById('admin-pkg-search')?.addEventListener('click', async () => {
        const pkg = document.getElementById('admin-pkg-name')?.value.trim();
        if (!pkg) return;
        const r = await this.connection.exec(`yum search ${pkg} 2>/dev/null | head -10 || apt-cache search ${pkg} 2>/dev/null | head -10`);
        window.app.notify(r.stdout.substring(0, 300) || 'No results', 'info');
      });
    }
    if (section === 'cron') {
      document.getElementById('admin-cron-add')?.addEventListener('click', async () => {
        const line = document.getElementById('admin-cron-line')?.value.trim();
        if (!line) return;
        await this.connection.exec(`(crontab -l 2>/dev/null; echo "${line}") | crontab -`);
        window.app.notify('Cron job added', 'success');
        this._loadSection('cron');
      });
    }
    if (section === 'namespaces') {
      document.getElementById('admin-ns-create-net')?.addEventListener('click', async () => {
        const r = await this.connection.exec('sudo ip netns add test-ns 2>&1 && sudo ip netns list');
        window.app.notify(r.code === 0 ? 'Created "test-ns"' : r.stdout, r.code === 0 ? 'success' : 'error');
        this._loadSection('namespaces');
      });
      document.getElementById('admin-ns-create-pid')?.addEventListener('click', async () => {
        const r = await this.connection.exec('sudo unshare --pid --fork --mount-proc readlink /proc/self/ns/pid 2>&1');
        window.app.notify('PID NS: ' + r.stdout.trim(), 'info');
      });
      document.getElementById('admin-ns-list')?.addEventListener('click', () => this._loadSection('namespaces'));
    }
    if (section === 'netns') {
      document.getElementById('admin-netns-create')?.addEventListener('click', async () => {
        const r = await this.connection.exec('sudo ip netns add test 2>&1 && sudo ip netns exec test ip link set lo up 2>&1 && echo "Created net NS test with loopback up"');
        window.app.notify(r.stdout.trim(), r.code === 0 ? 'success' : 'error');
        this._loadSection('netns');
      });
      document.getElementById('admin-netns-exec')?.addEventListener('click', async () => {
        const r = await this.connection.exec('sudo ip netns exec test ip addr 2>&1 || echo "NS test not found"');
        window.app.notify(r.stdout.substring(0, 300), 'info');
      });
    }
    if (section === 'containers') {
      document.getElementById('admin-mini-container')?.addEventListener('click', async () => {
        const r = await this.connection.exec('sudo unshare --pid --net --uts --mount --fork hostname mini-container 2>&1 && echo "Mini container created (exited)"');
        window.app.notify(r.stdout.trim() || 'Namespace created', 'success');
      });
    }
  }

  _esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  dispose() { if (this._refreshTimer) clearInterval(this._refreshTimer); }
}
window.LinuxAdminPanel = LinuxAdminPanel;
