import React, { useState, useEffect } from 'react';
import {
  Shield,
  Database,
  RefreshCw,
  FileCode,
  Terminal,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  FolderTree,
  Server,
  Settings,
  HelpCircle,
  Copy,
  ChevronRight,
  HardDrive,
  Cpu,
  Fingerprint
} from 'lucide-react';

// Pre-defined configuration metadata representing real platform state
const POSTGRESQL_METADATA = {
  host: '192.168.1.226',
  srvName: 'horus-db-srv01',
  port: 5432,
  databases: [
    { name: 'vault', owner: 'vault', purpose: 'HashiCorp Vault backend storage' },
    { name: 'gitea', owner: 'gitea', purpose: 'Self-hosted git repository server' },
    { name: 'harbor', owner: 'harbor', purpose: 'Docker & Helm registry server' },
    { name: 'authentik', owner: 'authentik', purpose: 'Identity and Access Management SSO' }
  ]
};

const VAULT_METADATA = {
  apiPort: 8200,
  clusterPort: 8201,
  apiAddr: 'https://192.168.1.226:8200',
  storageBackend: 'PostgreSQL (Stage 3.1)',
  policies: [
    { name: 'admin-policy', desc: 'Sudo-level root privileges on all secret engines' },
    { name: 'jenkins-policy', desc: 'Allows read/list access to databases secrets and TLS keys' },
    { name: 'gitea-policy', desc: 'Allows read access to Gitea DB secrets and custom certificates' },
    { name: 'harbor-policy', desc: 'Allows read access to Harbor DB, TLS, and Docker registry credentials' },
    { name: 'authentik-policy', desc: 'Allows read access to Authentik DB and TLS secrets' }
  ]
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'postgres' | 'vault' | 'rotation' | 'recovery'>('dashboard');
  
  // Interactive Simulation States
  const [vaultSealed, setVaultSealed] = useState(true);
  const [unsealProgress, setUnsealProgress] = useState(0);
  const [isUnsealing, setIsUnsealing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationLog, setRotationLog] = useState<string[]>([]);
  const [targetService, setTargetService] = useState<'jenkins' | 'gitea' | 'harbor' | 'authentik'>('jenkins');
  
  // Storage simulation of local files on Ansible control machine
  const [localApproles, setLocalApproles] = useState({
    jenkins: { role_id: '9dfc3e21-0be4-1a3b-9fb2-ff5940d9d0e2', secret_id: '81c7e900-2f34-cf82-cd21-e0094bc3921b' },
    gitea: { role_id: '2cf15b90-1c39-4dbe-a82f-b40ee9dd9f12', secret_id: '439a0ef2-9bb2-00df-f12b-da99cc098eef' },
    harbor: { role_id: 'a891001d-5b32-c21d-bd22-fa01ef41de33', secret_id: 'bcdd01ea-09ab-234b-c01d-768998bc43d1' },
    authentik: { role_id: 'f87bb90a-cd32-9df1-ab22-09cda019fe82', secret_id: '5426cdbf-cbde-001d-bf12-adfe980cdbe2' }
  });

  const [simulatedSecrets, setSimulatedSecrets] = useState({
    'secret/platform/databases/vault': { version: 1, exist: true, date: '2026-07-13 13:43:00' },
    'secret/platform/databases/gitea': { version: 1, exist: true, date: '2026-07-13 13:43:01' },
    'secret/platform/databases/harbor': { version: 1, exist: true, date: '2026-07-13 13:43:02' },
    'secret/platform/databases/authentik': { version: 1, exist: true, date: '2026-07-13 13:43:03' },
    'secret/platform/tls': { version: 1, exist: true, date: '2026-07-13 13:43:04' },
    'secret/platform/docker': { version: 1, exist: true, date: '2026-07-13 13:43:05' },
    'secret/platform/github': { version: 1, exist: true, date: '2026-07-13 13:43:06' },
  });

  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActiveNotification(msg);
    setTimeout(() => {
      setActiveNotification(null);
    }, 3000);
  };

  // Unseal simulation
  const handleAutoUnseal = () => {
    if (!vaultSealed) return;
    setIsUnsealing(true);
    setUnsealProgress(0);
    const interval = setInterval(() => {
      setUnsealProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setVaultSealed(false);
          setIsUnsealing(false);
          showNotification("Vault unsealed successfully using local recovery keys!");
          return 100;
        }
        return prev + 20;
      });
    }, 300);
  };

  // SecretID Rotation playbook simulator
  const runRotationPlaybook = () => {
    setIsRotating(true);
    setRotationLog([]);
    const logs = [
      `PLAY [Stage 3.2 — HashiCorp Vault SecretID Rotation] **************************************`,
      `TASK [Validate target service argument] ***************************************************`,
      `ok: [vault-srv] => msg="Target service '${targetService}' validated successfully."`,
      `TASK [Check local init.json existence to load root token] ********************************`,
      `ok: [localhost] => {"changed": false, "stat": {"exists": true, "path": "bootstrap/vault/init.json"}}`,
      `TASK [Load local Vault keys] **************************************************************`,
      `ok: [localhost]`,
      `TASK [Verify Vault is unsealed] ***********************************************************`,
      vaultSealed 
        ? `changed: [vault-srv] => {"changed": true, "msg": "Vault was found SEALED. Initiating automatic unseal..."}`
        : `ok: [vault-srv] => {"changed": false, "msg": "Vault is already UNSEALED."}`,
    ];

    let logIndex = 0;
    const interval = setInterval(() => {
      if (logIndex < logs.length) {
        setRotationLog((prev) => [...prev, logs[logIndex]]);
        logIndex++;
      } else {
        clearInterval(interval);
        
        // If Vault was sealed, unseal it during the run
        if (vaultSealed) {
          setVaultSealed(false);
        }

        // Generate custom values
        const randomHex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        const newSecretID = `${randomHex()}${randomHex()}-${randomHex()}-${randomHex()}-${randomHex()}-${randomHex()}${randomHex()}${randomHex()}`;
        
        const finalLogs = [
          `TASK [Unseal Vault if sealed] *************************************************************`,
          vaultSealed ? `changed: [vault-srv] => (loop) => unsealed with key thresholds met.` : `skipping: [vault-srv]`,
          `TASK [Generate new SecretID for target service] *******************************************`,
          `changed: [vault-srv] => {"changed": true, "secret_id": "${newSecretID}"}`,
          `TASK [Retrieve RoleID for target service] **************************************************`,
          `ok: [vault-srv] => {"role_id": "${localApproles[targetService].role_id}"}`,
          `TASK [Save updated AppRoles file locally] **************************************************`,
          `changed: [localhost] => {"changed": true, "dest": "bootstrap/vault/approles.json"}`,
          `TASK [Print Rotated Credentials Details] ***************************************************`,
          `ok: [vault-srv] => {`,
          `    "msg": [`,
          `        "SecretID rotated successfully for service: ${targetService}",`,
          `        "RoleID: ${localApproles[targetService].role_id}",`,
          `        "New SecretID: ${newSecretID}",`,
          `        "Local file updated: bootstrap/vault/approles.json"`,
          `    ]`,
          `}`,
          `PLAY RECAP ********************************************************************************`,
          `localhost                  : ok=5    changed=2    unreachable=0    failed=0    skipped=0`,
          `vault-srv                  : ok=6    changed=2    unreachable=0    failed=0    skipped=0`
        ];

        let finalLogIndex = 0;
        const finalInterval = setInterval(() => {
          if (finalLogIndex < finalLogs.length) {
            setRotationLog((prev) => [...prev, finalLogs[finalLogIndex]]);
            finalLogIndex++;
          } else {
            clearInterval(finalInterval);
            setIsRotating(false);
            
            // Save the newly rotated Secret ID locally
            setLocalApproles((prev) => ({
              ...prev,
              [targetService]: {
                ...prev[targetService],
                secret_id: newSecretID
              }
            }));
            showNotification(`SecretID rotated successfully for service: ${targetService}!`);
          }
        }, 150);
      }
    }, 200);
  };

  // Simulate updating a platform secret and show version bump
  const handleUpdateSecret = (secretPath: string) => {
    setSimulatedSecrets((prev) => {
      const current = prev[secretPath as keyof typeof prev];
      const now = new Date();
      const pad = (num: number) => num.toString().padStart(2, '0');
      const dateString = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      
      return {
        ...prev,
        [secretPath]: {
          ...current,
          version: current.version + 1,
          date: dateString
        }
      };
    });
    showNotification(`Secret updated at ${secretPath}. Version bumped!`);
  };

  return (
    <div className="flex h-screen bg-slate-950 font-sans antialiased text-slate-200">
      
      {/* Toast Notification */}
      {activeNotification && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-emerald-550 border border-emerald-500/55 bg-emerald-950 px-4 py-3 rounded-lg shadow-xl animate-fade-in-down">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-medium text-emerald-100">{activeNotification}</span>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="w-80 bg-slate-900 border-r border-slate-800/80 flex flex-col justify-between">
        <div>
          <div className="p-6 border-b border-slate-800/60">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-center">
                <span className="text-2xl">🦉</span>
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                  HoRus IaC
                </h1>
                <p className="text-xs text-slate-400 font-mono">Infrastructure Platform</p>
              </div>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-slate-800 text-white shadow-md shadow-slate-950/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Server className="w-4.5 h-4.5" />
              Overview Dashboard
            </button>
            <button
              onClick={() => setActiveTab('postgres')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'postgres'
                  ? 'bg-slate-800 text-white shadow-md shadow-slate-950/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Database className="w-4.5 h-4.5" />
              PostgreSQL (Stage 3.1)
            </button>
            <button
              onClick={() => setActiveTab('vault')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'vault'
                  ? 'bg-slate-800 text-white shadow-md shadow-slate-950/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <Shield className="w-4.5 h-4.5" />
              HashiCorp Vault (Stage 3.2)
            </button>
            <button
              onClick={() => setActiveTab('rotation')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'rotation'
                  ? 'bg-slate-800 text-white shadow-md shadow-slate-950/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <RefreshCw className="w-4.5 h-4.5" />
              Day-2 SecretID Rotation
            </button>
            <button
              onClick={() => setActiveTab('recovery')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'recovery'
                  ? 'bg-slate-800 text-white shadow-md shadow-slate-950/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <AlertTriangle className="w-4.5 h-4.5" />
              Disaster Recovery Guide
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800/60 bg-slate-950/40">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-2.5 h-2.5 rounded-full ${vaultSealed ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
            <span className="text-xs text-slate-400 font-medium">
              Vault Status: <span className={vaultSealed ? 'text-amber-400' : 'text-emerald-400'}>{vaultSealed ? 'SEALED' : 'UNSEALED'}</span>
            </span>
          </div>
          {vaultSealed && (
            <button
              onClick={handleAutoUnseal}
              disabled={isUnsealing}
              className="w-full py-2 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-850 disabled:text-emerald-400/80 rounded-md transition-all text-white flex items-center justify-center gap-1.5 shadow"
            >
              {isUnsealing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Auto-Unsealing {unsealProgress}%
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" />
                  Run Ansible Auto-Unseal
                </>
              )}
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-slate-950 overflow-y-auto flex flex-col justify-between">
        
        {/* Header */}
        <header className="px-8 py-5 border-b border-slate-800/60 bg-slate-900/40 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-xs text-slate-400 font-mono mb-1">
              <span>HoRus IaC Platform</span>
              <span>/</span>
              <span className="text-slate-300">
                {activeTab === 'dashboard' && 'Platform Overview'}
                {activeTab === 'postgres' && 'Stage 3.1 — PostgreSQL Cluster'}
                {activeTab === 'vault' && 'Stage 3.2 — HashiCorp Vault Service'}
                {activeTab === 'rotation' && 'Day-2 Operations — AppRole Rotation'}
                {activeTab === 'recovery' && 'Disaster Recovery & Backups'}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {activeTab === 'dashboard' && 'Platform Hub'}
              {activeTab === 'postgres' && 'High-Availability PostgreSQL Cluster'}
              {activeTab === 'vault' && 'Secure Vault Management'}
              {activeTab === 'rotation' && 'AppRole SecretID Rotation Simulator'}
              {activeTab === 'recovery' && 'Disaster Recovery & Backup Strategy'}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-mono text-slate-300">
              Ansible 2.15+
            </span>
            <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-mono text-slate-300">
              Debian 12 Bookworm
            </span>
          </div>
        </header>

        {/* Dynamic Section Contents */}
        <div className="flex-1 p-8">

          {/* 1. OVERVIEW DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              
              {/* Top Banner Alert */}
              <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
                  <Shield className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">Stage 3.2 Secure Architecture Initialized</h4>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
                    HoRus successfully configures Vault using PostgreSQL storage, unseals automatically via local custodian keys, disables anonymous telemetry endpoints, builds idempotent secrets logic, and provisions scoped policies and AppRoles for client services.
                  </p>
                </div>
              </div>

              {/* Grid of Stages */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Stage 3.1 PostgreSQL Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-slate-700/60 transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-550/10 border border-blue-500/20 rounded-lg text-blue-400">
                          <Database className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs text-slate-400 font-mono">STAGE 3.1</span>
                          <h3 className="font-bold text-base text-white">PostgreSQL HA Cluster</h3>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 bg-emerald-950/80 border border-emerald-500/30 text-emerald-400 text-xs font-semibold rounded-full">
                        ACTIVE
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                      Initializes high-availability relational databases on <code className="text-blue-300 font-mono font-medium">horus-db-srv01</code>. Generates isolated databases and user credentials for platform services.
                    </p>

                    <div className="space-y-2 border-t border-slate-800/80 pt-4 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Database Host:</span>
                        <span className="text-slate-300">{POSTGRESQL_METADATA.host}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Databases Provisioned:</span>
                        <span className="text-slate-300">vault, gitea, harbor, authentik</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Service Port:</span>
                        <span className="text-slate-300">5432 (Isolated local access)</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('postgres')}
                    className="mt-6 w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg text-slate-200 transition-all border border-slate-700/50 flex items-center justify-center gap-1.5"
                  >
                    View DB Config
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Stage 3.2 HashiCorp Vault Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-slate-700/60 transition-all">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-purple-550/10 border border-purple-500/20 rounded-lg text-purple-400">
                          <Shield className="w-5 h-5" />
                        </div>
                        <div>
                          <span className="text-xs text-slate-400 font-mono">STAGE 3.2</span>
                          <h3 className="font-bold text-base text-white">HashiCorp Vault</h3>
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 border text-xs font-semibold rounded-full ${
                        vaultSealed 
                          ? 'bg-amber-950/80 border-amber-500/30 text-amber-400' 
                          : 'bg-emerald-950/80 border-emerald-500/30 text-emerald-400'
                      }`}>
                        {vaultSealed ? 'SEALED' : 'UNSEALED'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                      Secures application secret workflows. Restricts access exclusively through granular HCL policies, enables AppRoles for core platforms, and supports automated unseal.
                    </p>

                    <div className="space-y-2 border-t border-slate-800/80 pt-4 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-500">API Endpoint:</span>
                        <span className="text-purple-300 text-right overflow-hidden text-ellipsis whitespace-nowrap max-w-xs">{VAULT_METADATA.apiAddr}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Storage Type:</span>
                        <span className="text-slate-300">PostgreSQL Relational Storage</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Active AppRoles:</span>
                        <span className="text-slate-300">jenkins, gitea, harbor, authentik</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveTab('vault')}
                    className="mt-6 w-full py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-lg text-slate-200 transition-all border border-slate-700/50 flex items-center justify-center gap-1.5"
                  >
                    Manage Vault
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>

              {/* Secure Credentials Hierarchy */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <FolderTree className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-base text-white">Ansible Control Node - Secure Bootstrap Folder Structure</h3>
                </div>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                  To isolate critical cluster administrative credentials from general application databases, all initialization vectors, root tokens, recovery files, and AppRole mapping tables are generated in a highly restrictive root-only directory (<code className="text-emerald-300">0700</code> and <code className="text-emerald-300">0600</code> file attributes) which is entirely excluded from public repositories.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
                  
                  <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">init.json</span>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">0600</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                      Contains raw response from Vault initial cluster orchestration.
                    </p>
                    <div className="text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded text-center truncate">
                      {"{ \"unseal_keys_b64\": ... }"}
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">recovery.json</span>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">0600</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                      5 Base64 encoded keys to perform cluster unseal workflows automatically.
                    </p>
                    <div className="text-[10px] text-emerald-400 bg-slate-900/60 p-1.5 rounded text-center truncate">
                      [ "unseal_k1", "unseal_k2", ... ]
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">root_token.txt</span>
                      <span className="text-[10px] bg-amber-950 border border-amber-500/20 px-2 py-0.5 rounded text-amber-400">0600</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                      Isolated root administrative token. Absolutely forbidden for daily runtime usage.
                    </p>
                    <div className="text-[10px] text-slate-400 bg-slate-900/60 p-1.5 rounded text-center truncate">
                      hvs.gS945A7...
                    </div>
                  </div>

                  <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-semibold">approles.json</span>
                      <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400">0600</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                      Stored RoleIDs and static, reusable SecretIDs for platform authentication.
                    </p>
                    <div className="text-[10px] text-purple-400 bg-slate-900/60 p-1.5 rounded text-center truncate">
                      {"{ \"jenkins\": { ... } }"}
                    </div>
                  </div>

                </div>
              </div>

            </div>
          )}


          {/* 2. POSTGRESQL (STAGE 3.1) */}
          {activeTab === 'postgres' && (
            <div className="space-y-6">
              
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-blue-550/10 border border-blue-500/20 rounded-lg text-blue-400">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white">Debian 12 PostgreSQL Cluster Architecture</h3>
                    <p className="text-xs text-slate-400 font-mono">Target Host: horus-db-srv01 (192.168.1.226)</p>
                  </div>
                </div>

                <p className="text-sm text-slate-300 leading-relaxed max-w-4xl mb-6">
                  In Stage 3.1, our automated Ansible scripts configured PostgreSQL, generated a local database server cluster, set up secure TCP listening configurations binded to safe host IP endpoints, and generated dedicated isolated databases and credential scopes for platform storage.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {POSTGRESQL_METADATA.databases.map((db) => (
                    <div key={db.name} className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-3 hover:border-slate-700/40 transition-all">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold px-2 py-0.5 bg-blue-950 border border-blue-500/30 text-blue-300 rounded font-mono">
                          db: {db.name}
                        </span>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 font-mono block">Owner User:</span>
                        <span className="text-xs font-semibold font-mono text-white">{db.owner}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[11px] text-slate-500 font-mono block">Purpose:</span>
                        <span className="text-xs text-slate-400 leading-relaxed block">{db.purpose}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PostgreSQL Config Task Preview */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h4 className="font-bold text-sm text-white mb-4 flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-blue-400" />
                  Automated Task Configurations (roles/postgresql/tasks/config.yml)
                </h4>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-4">
                  <div>
                    <span className="text-slate-500"># Configure PostgreSQL to listen on hosts network adapter</span>
                    <pre className="text-emerald-400 mt-1">
{`- name: Configure PostgreSQL listening address
  ansible.builtin.lineinfile:
    path: /etc/postgresql/{{ postgresql_version }}/main/postgresql.conf
    regexp: "^#?listen_addresses\\s*=.*"
    line: "listen_addresses = '*'"
  notify: Restart PostgreSQL`}
                    </pre>
                  </div>
                  <div className="border-t border-slate-800/80 pt-4">
                    <span className="text-slate-500"># Restrict database connectivity exclusively to trust ranges</span>
                    <pre className="text-emerald-400 mt-1">
{`- name: Configure pg_hba.conf for secure network ranges
  ansible.builtin.blockinfile:
    path: /etc/postgresql/{{ postgresql_version }}/main/pg_hba.conf
    block: |
      host    all             all             192.168.1.0/24          scram-sha-256
      host    vault           vault           192.168.1.227/32        scram-sha-256
  notify: Restart PostgreSQL`}
                    </pre>
                  </div>
                </div>
              </div>

            </div>
          )}


          {/* 3. HASHICORP VAULT (STAGE 3.2) */}
          {activeTab === 'vault' && (
            <div className="space-y-6">

              {/* Top Row Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
                  <span className="text-xs text-slate-400 font-mono">Service Interface</span>
                  <p className="text-lg font-bold text-white font-mono">TCP :8200</p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
                  <span className="text-xs text-slate-400 font-mono">Metrics API Endpoints</span>
                  <p className="text-lg font-bold text-amber-400 font-mono flex items-center gap-1.5">
                    <Lock className="w-4 h-4" />
                    AUTHENTICATED ONLY
                  </p>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-1">
                  <span className="text-xs text-slate-400 font-mono">Active Engine Mounted</span>
                  <p className="text-lg font-bold text-white font-mono">KV Version 2</p>
                </div>
              </div>

              {/* Idempotent Key Writing Demo */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Settings className="w-5 h-5 text-purple-400" />
                    <h3 className="font-bold text-base text-white">Idempotent Secrets Write Simulation (KV v2)</h3>
                  </div>
                  <span className="text-[11px] text-purple-300 font-mono bg-purple-950 px-2.5 py-0.5 border border-purple-500/20 rounded-full">
                    No Overwrites & Prevents Version Bloating
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Vault's KV-v2 engine automatically increments keys versions upon any <code className="text-purple-300">put</code> execution. To make our Ansible playbooks cleanly idempotent, the playbook first executes a <code className="text-purple-300">vault kv get</code> check. It only issues a write if the secret path is completely empty, preserving your secrets and preventing bloated version histories.
                </p>

                <div className="space-y-3">
                  {Object.entries(simulatedSecrets).map(([path, value]) => (
                    <div key={path} className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400">{path}</span>
                        <span className="px-2 py-0.5 bg-slate-900 rounded text-purple-400 font-bold">
                          v{value.version}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-[11px]">
                        <span className="text-slate-500">Last Write: {value.date}</span>
                        <button
                          onClick={() => handleUpdateSecret(path)}
                          className="py-1 px-2.5 bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/20 hover:border-purple-500/40 rounded transition-all"
                        >
                          Trigger Update
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policies list with pre-configured PKI ready paths */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Fingerprint className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-base text-white">Custom HCL Authorization Policies (including PKI readiness)</h3>
                </div>
                <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                  Platform roles contain fine-grained path permissions. To prepare the platform for the upcoming <strong className="text-white">Stage 5 PKI Dynamic Certificate Engine</strong>, all policy templates now contain pre-approved paths allowing automated SSL/TLS issuance roles to write and refresh local nodes certificates!
                </p>

                <div className="space-y-3 font-mono text-xs">
                  {VAULT_METADATA.policies.map((policy) => (
                    <div key={policy.name} className="p-4 bg-slate-950 border border-slate-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-purple-300 font-semibold">{policy.name}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-slate-900 rounded text-slate-400">HCL policy file</span>
                      </div>
                      <p className="text-slate-400 text-[11px] mb-3 leading-relaxed">{policy.desc}</p>
                      
                      {policy.name !== 'admin-policy' && (
                        <div className="p-2.5 bg-slate-900/50 border border-slate-800 rounded text-[11px] text-slate-500 leading-relaxed">
                          <span className="text-slate-400 font-semibold block mb-1">PKI Integration Block Added:</span>
                          path "pki/issue/{policy.name.replace('-policy', '')}-cert-role" {"{ capabilities = [\"create\", \"update\"] }"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}


          {/* 4. DAY-2 SECRETID ROTATION */}
          {activeTab === 'rotation' && (
            <div className="space-y-6">
              
              {/* Controls */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h3 className="font-bold text-base text-white mb-2 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-emerald-400" />
                  AppRole SecretID Rotation Control Room
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-6">
                  Running a full Vault deployment should not regenerate active services SecretIDs (which would instantly break running environments such as Gitea or Jenkins). Below, select a service and launch a simulated task from our dedicated playbook <code className="text-emerald-300">vault_rotate_secretid.yml</code> to securely issue and write down a single updated SecretID dynamically without invalidating others!
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="flex-1 w-full space-y-1">
                    <label className="text-xs text-slate-400 block font-mono">Select Service Platform Target:</label>
                    <select
                      value={targetService}
                      onChange={(e) => setTargetService(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none focus:border-slate-700 transition-all font-mono"
                    >
                      <option value="jenkins">jenkins (Jenkins CI/CD Platform)</option>
                      <option value="gitea">gitea (Gitea Git Server)</option>
                      <option value="harbor">harbor (Harbor Docker Registry)</option>
                      <option value="authentik">authentik (Authentik Single Sign-On)</option>
                    </select>
                  </div>

                  <button
                    onClick={runRotationPlaybook}
                    disabled={isRotating}
                    className="w-full sm:w-auto self-end py-2 px-6 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-850 disabled:text-emerald-400/80 rounded-lg transition-all text-white font-medium flex items-center justify-center gap-2 shadow"
                  >
                    {isRotating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Running Ansible Playbook...
                      </>
                    ) : (
                      <>
                        <Terminal className="w-4 h-4" />
                        Rotate {targetService} SecretID
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Split Terminal and Local AppRoles view */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Live Console Output Log */}
                <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col h-[400px]">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <span className="text-xs font-semibold text-white flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-400" />
                      Ansible Live Playbook stdout log
                    </span>
                    <span className="px-2 py-0.5 bg-slate-800 rounded text-[10px] font-mono text-slate-400">CWD: /playbooks</span>
                  </div>

                  <div className="flex-1 bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 overflow-y-auto space-y-1.5 scrollbar-thin">
                    {rotationLog.length === 0 ? (
                      <span className="text-slate-600 italic block">Ready to execute. Click "Rotate SecretID" to trigger the Ansible playbook simulator...</span>
                    ) : (
                      rotationLog.map((log, idx) => (
                        <div key={idx} className={
                          log.startsWith('PLAY') || log.startsWith('TASK') 
                            ? 'text-white font-bold mt-2' 
                            : log.includes('changed') 
                              ? 'text-amber-400' 
                              : log.includes('failed') 
                                ? 'text-rose-400' 
                                : 'text-slate-400'
                        }>
                          {log}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Local Storage database layout view */}
                <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-white mb-1.5 flex items-center gap-2">
                      <HardDrive className="w-4.5 h-4.5 text-blue-400" />
                      Local Storage Cache (bootstrap/vault/approles.json)
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed mb-4">
                      This represents the secure JSON credentials lookup mapping managed locally on your Ansible management host. Service integrations poll these values for initialization.
                    </p>

                    <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3 space-y-3.5 font-mono text-xs">
                      {Object.entries(localApproles).map(([service, creds]) => (
                        <div key={service} className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-emerald-400 font-semibold">{service} app</span>
                            {service === targetService && isRotating && (
                              <span className="text-[10px] bg-amber-950 text-amber-400 px-1.5 py-0.2 rounded animate-pulse">ROTATING</span>
                            )}
                          </div>
                          <div className="pl-3 border-l border-slate-800 space-y-0.5 text-[11px]">
                            <div className="flex justify-between">
                              <span className="text-slate-500">RoleID:</span>
                              <span className="text-slate-300 select-all">{creds.role_id}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">SecretID:</span>
                              <span className="text-slate-300 font-semibold select-all text-purple-400">{creds.secret_id}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-slate-950/40 border border-slate-800/60 rounded-lg text-[11px] text-slate-400 flex items-start gap-2.5 leading-relaxed">
                    <Settings className="w-5 h-5 text-slate-500 shrink-0" />
                    <span>RoleID remains constant across runs to prevent breaking client service configurations; only the SecretID credentials pair rotates.</span>
                  </div>
                </div>

              </div>

            </div>
          )}


          {/* 5. DISASTER RECOVERY & BACKUP */}
          {activeTab === 'recovery' && (
            <div className="space-y-6">

              {/* Disaster warning block */}
              <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-4">
                <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">CRITICAL INFRASTRUCTURE WARNING</h4>
                  <p className="text-xs text-rose-300 leading-relaxed max-w-4xl">
                    Since Vault's encryption keys and initial root tokens are managed locally on the Ansible Control Node (inside the secure but transient <code className="text-white">bootstrap/vault/</code> directory), losing this machine or clearing the local cache will permanently lock you out of Vault administrative controls. Implement a robust backup routine immediately.
                  </p>
                </div>
              </div>

              {/* Split columns for backup/restore */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Backup Guide */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    How to Backup Your Vault Credentials Directory
                  </h3>
                  
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Create an automated backup script on your host machine to archive and encrypt the secure credentials directory immediately following successful platform bootstrap runs.
                  </p>

                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-3">
                    <div>
                      <span className="text-slate-500"># 1. Compress the secure vault directory securely</span>
                      <pre className="text-blue-300 mt-1">
                        {"tar -czf /tmp/vault_backup.tar.gz ./bootstrap/vault"}
                      </pre>
                    </div>
                    <div>
                      <span className="text-slate-500"># 2. Encrypt the backup archive using GnuPG</span>
                      <pre className="text-blue-300 mt-1">
                        {"gpg --symmetric --cipher-algo AES255 \\"}<br />
                        {"  /tmp/vault_backup.tar.gz"}
                      </pre>
                    </div>
                    <div>
                      <span className="text-slate-500"># 3. Securely store vault_backup.tar.gz.gpg in safe storage</span>
                      <pre className="text-blue-300 mt-1">
                        {"# Upload to password manager vaults or cold harddrive"}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Disaster Restore steps */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    Disaster Recovery Process (Control Host Rebuild)
                  </h3>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    If your control node is completely destroyed, follow these steps to restore full administrative and unseal connection capabilities to the existing PostgreSQL database cluster:
                  </p>

                  <ol className="text-xs text-slate-300 space-y-3 list-decimal pl-4">
                    <li>
                      <strong className="text-white">Re-deploy the control node software stack</strong>: Set up Ansible, install standard requirements, and restore ssh communication with the server nodes.
                    </li>
                    <li>
                      <strong className="text-white">Restore the backup files</strong>: Retrieve your encrypted `vault_backup.tar.gz.gpg` archive, decrypt it, and extract it back into the root <code className="text-emerald-300 font-mono">bootstrap/vault/</code> workspace.
                    </li>
                    <li>
                      <strong className="text-white">Run playbooks</strong>: Run <code className="text-emerald-300 font-mono">ansible-playbook playbooks/vault.yml</code>. Ansible will detect that <code className="text-emerald-300 font-mono">init.json</code> is present, bypass the initialization stage, load the unseal keys, and fully connect to and authorize against the running Vault cluster!
                    </li>
                  </ol>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Footer info bar */}
        <footer className="px-8 py-4 border-t border-slate-800/60 bg-slate-900/20 text-[11px] text-slate-500 flex justify-between items-center font-mono">
          <span>HoRus IaC Control Panel v0.0.1</span>
          <span>Status: Fully Configured</span>
        </footer>

      </main>

    </div>
  );
}
